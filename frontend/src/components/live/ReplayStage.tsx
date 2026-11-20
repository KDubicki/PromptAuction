import { Box, Button, Card, Stack, Typography } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'

import { QualityMeter } from './Rostrum'
import { growUp, useCountUp } from '../../motion'
import type { RoundState } from '../../replay'
import type { Lot } from '../../types'

interface Props {
  lot: Lot
  lotsCount: number
  states: RoundState[]
  round: number
  playing: boolean
  onRound: (round: number) => void
  onTogglePlay: () => void
}

const CHART_HEIGHT = 88

/**
 * Price after each round as a bar; the bars double as the scrubber. Rounds
 * after the one being shown stay flat, so a replay never gives away the ending.
 */
function RoundChart({ lotNumber, states, round, onRound }: Pick<Props, 'states' | 'round' | 'onRound'> & { lotNumber: number }) {
  const max = Math.max(1, ...states.filter((s) => s.round <= round).map((s) => s.price))
  return (
    <Box
      role="group"
      aria-label="Price by round"
      sx={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: CHART_HEIGHT + 22, borderBottom: 1, borderColor: 'divider' }}
    >
      {states.map((s) => {
        const shown = s.round <= round
        const current = s.round === round
        const height = shown && s.price > 0 ? Math.max(4, (s.price / max) * CHART_HEIGHT) : 2
        return (
          <Box
            key={`${lotNumber}-${s.round}`}
            component="button"
            type="button"
            onClick={() => onRound(s.round)}
            aria-label={shown ? `Round ${s.round}: ${s.price > 0 ? `${s.price}, ${s.leader} leads` : 'no bids'}` : `Round ${s.round}`}
            aria-pressed={current}
            title={shown ? `Round ${s.round}: ${s.price > 0 ? `${s.price} by ${s.leader}` : 'no bids'}${s.raised ? '' : ', nobody raised'}` : `Round ${s.round}`}
            sx={{
              flex: '1 1 0',
              minWidth: 10,
              maxWidth: 120,
              height: '100%',
              p: 0,
              border: 0,
              bgcolor: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              alignItems: 'stretch',
              position: 'relative',
              '&:hover > .bar': { opacity: 1 },
            }}
          >
            {current && s.price > 0 && (
              <Typography
                variant="caption"
                data-figure
                sx={{ position: 'absolute', bottom: height + 4, left: '50%', transform: 'translateX(-50%)', color: 'text.primary', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                {s.price}
              </Typography>
            )}
            <Box
              className="bar"
              sx={{
                ...growUp(Math.min(s.round, 20) * 35),
                height,
                borderRadius: '4px 4px 0 0',
                bgcolor: shown && s.price > 0 ? 'primary.main' : 'text.disabled',
                opacity: shown ? (current ? 1 : s.raised ? 0.7 : 0.4) : 0.12,
                outline: current ? 2 : 0,
                outlineStyle: 'solid',
                outlineColor: (t: Theme) => t.palette.text.primary,
                outlineOffset: 1,
                transition: 'height 400ms ease, opacity 200ms ease',
              }}
            />
          </Box>
        )
      })}
    </Box>
  )
}

function Result({ lot }: { lot: Lot }) {
  const sold = lot.status === 'sold'
  return (
    <Box
      role="status"
      sx={{
        alignSelf: 'flex-start',
        px: 2,
        py: 1,
        borderRadius: 2,
        bgcolor: sold ? 'primary.main' : 'action.hover',
        color: sold ? 'primary.contrastText' : 'text.secondary',
        fontWeight: 600,
        animation: 'stampIn 380ms cubic-bezier(0.2, 0.9, 0.3, 1.3)',
        '@keyframes stampIn': { from: { opacity: 0, transform: 'scale(1.15)' }, to: { opacity: 1, transform: 'scale(1)' } },
      }}
    >
      {sold ? `Sold to ${lot.sold_to_name} for ${lot.price}${lot.sold_in_round ? ` in round ${lot.sold_in_round}` : ''}` : 'Unsold, nobody bid'}
    </Box>
  )
}

/** A closed lot, replayed round by round. */
export function ReplayStage({ lot, lotsCount, states, round, playing, onRound, onTogglePlay }: Props) {
  const total = states.length
  const state = states.find((s) => s.round === round) ?? null
  const price = state?.price ?? 0
  const shownPrice = useCountUp(price, { durationMs: 450 })
  const atEnd = round >= total

  return (
    <Card component="section" aria-labelledby="replay-lot" sx={{ overflow: 'hidden' }}>
      <Stack spacing={{ xs: 3, sm: 3.5 }} sx={{ px: { xs: 2, sm: 4 }, py: { xs: 2.5, sm: 3.5 } }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <Typography variant="overline" data-figure sx={{ color: 'text.secondary' }}>
            Replay, lot {lot.number} of {lotsCount}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: lot.required ? 'text.primary' : 'text.secondary' }}>
            {lot.required ? 'Required, counts toward winning' : 'Not required, counts for nothing'}
          </Typography>
        </Stack>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          sx={{ justifyContent: 'space-between', alignItems: { md: 'flex-end' }, gap: { xs: 2.5, md: 6 } }}
        >
          <Stack spacing={1.5} sx={{ minWidth: 0 }}>
            <Typography
              id="replay-lot"
              component="h2"
              sx={{
                fontFamily: (t) => t.typography.h1.fontFamily,
                fontWeight: 800,
                letterSpacing: '-0.035em',
                lineHeight: 0.95,
                fontSize: { xs: '2.5rem', sm: '3.5rem', lg: '4.5rem' },
                overflowWrap: 'anywhere',
              }}
            >
              {lot.item}
            </Typography>
            <QualityMeter quality={lot.quality} />
          </Stack>
          <Stack spacing={0.75} sx={{ alignItems: { md: 'flex-end' }, flexShrink: 0 }}>
            <Box
              data-figure
              aria-label={`Highest bid ${price}`}
              sx={{
                fontFamily: (t) => t.typography.caption.fontFamily,
                fontWeight: 500,
                fontSize: { xs: '3.5rem', sm: '4.5rem', lg: '5.5rem' },
                lineHeight: 0.85,
                letterSpacing: '-0.05em',
                color: price > 0 ? 'primary.main' : 'text.disabled',
                transition: 'color 300ms ease',
              }}
            >
              {shownPrice}
            </Box>
            <Typography sx={{ fontSize: '1.125rem', color: 'text.secondary' }}>
              {state?.leader ? (
                <>
                  held by{' '}
                  <Box component="strong" sx={{ color: 'primary.main', fontWeight: 600 }}>
                    {state.leader}
                  </Box>
                </>
              ) : (
                'No bids yet'
              )}
            </Typography>
          </Stack>
        </Stack>

        {total > 0 ? (
          <Stack spacing={1.5}>
            <RoundChart lotNumber={lot.number} states={states} round={round} onRound={onRound} />
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
                <Button
                  variant="contained"
                  onClick={onTogglePlay}
                  startIcon={playing ? <PauseIcon /> : <PlayArrowIcon />}
                  aria-label={playing ? 'Pause replay' : 'Play replay'}
                >
                  {playing ? 'Pause' : atEnd ? 'Replay lot' : 'Play'}
                </Button>
                <Typography variant="overline" data-figure sx={{ color: 'text.secondary' }}>
                  Round {round} of {total}
                </Typography>
              </Stack>
              {atEnd && <Result lot={lot} />}
            </Stack>
          </Stack>
        ) : (
          <Result lot={lot} />
        )}
      </Stack>
    </Card>
  )
}
