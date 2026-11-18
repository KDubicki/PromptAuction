import { Box, Card, Stack, Typography } from '@mui/material'

import { BidLadder } from './BidLadder'

interface Props {
  currentItem: string
  liveBids: Array<{ player: string; bid: number }>
  /** Sealed bids stay at the floor until the iteration resolves. */
  revealed?: boolean
  round?: number
  totalRounds?: number
  /** The lot's position in the round — one lot per iteration. */
  iteration?: number
  totalIterations?: number
}

/**
 * The rostrum. The lot on the block and the price the hammer fell at are the
 * two things a spectator looks for, so they lead; the bid ladder underneath
 * shows how the price was reached.
 */
export function ActionArena({
  currentItem,
  liveBids,
  revealed = true,
  round = 1,
  totalRounds = 1,
  iteration = 1,
  totalIterations = 1,
}: Props) {
  const highest = liveBids.reduce<number | null>((max, b) => (max === null || b.bid > max ? b.bid : max), null)
  const hammer = revealed ? highest : null
  const progress = totalIterations > 0 ? Math.min(100, (iteration / totalIterations) * 100) : 0

  return (
    <Card component="section" aria-labelledby="lot-on-the-block" sx={{ overflow: 'hidden' }}>
      <Stack spacing={{ xs: 3, sm: 4 }} sx={{ px: { xs: 2, sm: 3.5 }, pt: { xs: 2.5, sm: 3.5 }, pb: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ gap: { xs: 2, sm: 4 }, alignItems: { sm: 'flex-end' }, justifyContent: 'space-between' }}
        >
          <Stack spacing={1} sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }} data-figure>
              Lot {iteration} of {totalIterations}, round {round} of {totalRounds}
            </Typography>
            <Typography
              id="lot-on-the-block"
              variant="h1"
              component="h2"
              sx={{ fontSize: { xs: '2.25rem', sm: '3rem', md: '3.5rem' }, overflowWrap: 'anywhere' }}
            >
              {currentItem}
            </Typography>
          </Stack>

          <Stack spacing={0.5} sx={{ alignItems: { sm: 'flex-end' }, flexShrink: 0 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              Hammer price
            </Typography>
            <Box
              data-figure
              sx={{
                fontFamily: (t) => t.typography.caption.fontFamily,
                fontWeight: 500,
                fontSize: { xs: '2.75rem', sm: '3.5rem', md: '4rem' },
                lineHeight: 1,
                letterSpacing: '-0.03em',
                color: hammer === null ? 'text.disabled' : 'primary.main',
              }}
            >
              {hammer ?? '—'}
            </Box>
          </Stack>
        </Stack>

        <BidLadder
          bids={liveBids.map((entry) => ({ player: entry.player, amount: entry.bid }))}
          revealed={revealed}
        />
      </Stack>

      {/* How far the round has run. */}
      <Box
        role="progressbar"
        aria-label="Round progress"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        sx={{ height: 3, bgcolor: 'divider' }}
      >
        <Box sx={{ width: `${progress}%`, height: '100%', bgcolor: 'secondary.main' }} />
      </Box>
    </Card>
  )
}
