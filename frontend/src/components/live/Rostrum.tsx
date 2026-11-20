import { useEffect, useState } from 'react'
import { Box, Card, Stack, Typography } from '@mui/material'
import type { Theme } from '@mui/material/styles'

import type { GameSession, Lot } from '../../types'

const SOLD_BANNER_MS = 5000

const display = {
  fontFamily: (t: Theme) => t.typography.h1.fontFamily,
  fontWeight: 800,
  letterSpacing: '-0.035em',
  lineHeight: 0.95,
}

const figure = { fontFamily: (t: Theme) => t.typography.caption.fontFamily }

/** Ten segments, one per quality point. */
export function QualityMeter({ quality }: { quality: number }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
      <Stack
        direction="row"
        role="meter"
        aria-label="Quality"
        aria-valuenow={quality}
        aria-valuemin={1}
        aria-valuemax={10}
        sx={{ gap: '3px' }}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <Box
            key={i}
            sx={{
              width: { xs: 10, sm: 14 },
              height: 8,
              borderRadius: '2px',
              bgcolor: i < quality ? 'text.primary' : 'divider',
            }}
          />
        ))}
      </Stack>
      <Typography variant="overline" data-figure sx={{ color: 'text.secondary' }}>
        Quality {quality}
      </Typography>
    </Stack>
  )
}

/** One mark per round; the current one is lit, the ones behind it are spent. */
function RoundTrack({ current, max }: { current: number; max: number }) {
  const final = current === max
  return (
    <Stack spacing={0.75} sx={{ alignItems: { sm: 'flex-end' } }}>
      <Typography variant="overline" data-figure sx={{ color: final ? 'error.main' : 'text.secondary' }}>
        {final ? `Final round, ${current} of ${max}` : `Round ${current} of ${max}`}
      </Typography>
      <Stack direction="row" aria-hidden sx={{ gap: '4px', flexWrap: 'wrap', maxWidth: 260 }}>
        {Array.from({ length: max }, (_, i) => (
          <Box
            key={i}
            sx={{
              width: max > 20 ? 6 : 16,
              height: 4,
              borderRadius: '2px',
              bgcolor: i + 1 < current ? 'text.disabled' : i + 1 === current ? (final ? 'error.main' : 'secondary.main') : 'divider',
            }}
          />
        ))}
      </Stack>
    </Stack>
  )
}

function SoldBanner({ lot }: { lot: Lot }) {
  const sold = lot.status === 'sold'
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        textAlign: 'center',
        px: 2,
        bgcolor: sold ? 'primary.main' : 'background.paper',
        color: sold ? 'primary.contrastText' : 'text.primary',
        animation: 'stamp 420ms cubic-bezier(0.2, 0.9, 0.3, 1.3)',
        '@keyframes stamp': {
          from: { opacity: 0, transform: 'scale(1.12)' },
          to: { opacity: 1, transform: 'scale(1)' },
        },
      }}
    >
      <Box sx={{ ...display, fontSize: { xs: '3.5rem', sm: '5rem', md: '6.5rem' } }}>{sold ? 'Sold' : 'Unsold'}</Box>
      <Typography sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, fontWeight: 500 }}>
        {sold
          ? `${lot.item} goes to ${lot.sold_to_name} for ${lot.price}`
          : `Nobody bid on ${lot.item}`}
      </Typography>
    </Box>
  )
}

/**
 * Watches the lot number and, when the auction moves on, holds the lot that
 * just closed long enough for the room to see how it went.
 */
function useClosedLot(session: GameSession, lotNumber: number): Lot | null {
  const [seen, setSeen] = useState(lotNumber)
  const [closed, setClosed] = useState<Lot | null>(null)

  if (lotNumber !== seen) {
    setSeen(lotNumber)
    const previous = session.lots.find((lot) => lot.number === seen)
    if (lotNumber > seen && previous && previous.status !== 'pending') setClosed(previous)
  }

  useEffect(() => {
    if (!closed) return
    const timer = setTimeout(() => setClosed(null), SOLD_BANNER_MS)
    return () => clearTimeout(timer)
  }, [closed])

  return closed
}

function LastResult({ lot }: { lot: Lot }) {
  return (
    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
      {lot.status === 'sold'
        ? `Lot ${lot.number}, ${lot.item}, went to ${lot.sold_to_name} for ${lot.price}.`
        : `Lot ${lot.number}, ${lot.item}, went unsold.`}
    </Typography>
  )
}

interface Props {
  session: GameSession
  lot: Lot
}

/** The lot on the block and the price it stands at: what everyone in the room watches. */
export function Rostrum({ session, lot }: Props) {
  const auction = session.auction
  const closed = useClosedLot(session, lot.number)
  const previous = session.lots.find((l) => l.number === lot.number - 1 && l.status !== 'pending') ?? null
  const price = auction?.highest_bid ?? 0
  const leader = auction?.leader_name ?? null

  return (
    <Card
      component="section"
      aria-labelledby="lot-on-the-block"
      sx={{ position: 'relative', overflow: 'hidden', borderColor: leader ? 'primary.main' : undefined }}
    >
      <Box role="status" aria-live="polite">
        {closed && <SoldBanner lot={closed} />}
      </Box>

      <Stack spacing={{ xs: 3, sm: 4 }} sx={{ px: { xs: 2, sm: 4 }, py: { xs: 2.5, sm: 4 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ justifyContent: 'space-between', gap: 2, alignItems: { sm: 'flex-start' } }}
        >
          <Stack spacing={0.5}>
            <Typography variant="overline" data-figure sx={{ color: 'text.secondary' }}>
              Lot {lot.number} of {session.lots.length}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, color: lot.required ? 'text.primary' : 'text.secondary' }}
            >
              {lot.required ? 'Required, counts toward winning' : 'Not required, counts for nothing'}
            </Typography>
          </Stack>
          {auction && <RoundTrack current={auction.current_round} max={session.settings.max_rounds} />}
        </Stack>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          sx={{ justifyContent: 'space-between', alignItems: { md: 'flex-end' }, gap: { xs: 3, md: 6 } }}
        >
          <Stack spacing={2} sx={{ minWidth: 0 }}>
            <Typography
              id="lot-on-the-block"
              component="h2"
              sx={{ ...display, fontSize: { xs: '2.75rem', sm: '4rem', lg: '5.25rem' }, overflowWrap: 'anywhere' }}
            >
              {lot.item}
            </Typography>
            <QualityMeter quality={lot.quality} />
          </Stack>

          <Stack spacing={1} sx={{ alignItems: { md: 'flex-end' }, flexShrink: 0 }}>
            <Box
              key={price}
              data-figure
              aria-label={`Highest bid ${price}`}
              sx={{
                ...figure,
                fontWeight: 500,
                fontSize: { xs: '4rem', sm: '5.5rem', lg: '7rem' },
                lineHeight: 0.85,
                letterSpacing: '-0.05em',
                color: price > 0 ? 'primary.main' : 'text.disabled',
                animation: price > 0 ? 'raise 650ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
                '@keyframes raise': {
                  from: { opacity: 0.25, transform: 'translateY(14px)' },
                  to: { opacity: 1, transform: 'translateY(0)' },
                },
              }}
            >
              {price}
            </Box>
            <Typography
              sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem' }, color: leader ? 'text.primary' : 'text.secondary' }}
            >
              {leader ? (
                <>
                  held by{' '}
                  <Box component="strong" sx={{ color: 'primary.main', fontWeight: 600 }}>
                    {leader}
                  </Box>
                </>
              ) : (
                'No bids yet'
              )}
            </Typography>
          </Stack>
        </Stack>

        {previous && (
          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
            <LastResult lot={previous} />
          </Box>
        )}
      </Stack>
    </Card>
  )
}
