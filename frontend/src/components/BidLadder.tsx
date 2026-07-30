import { useMemo } from 'react'
import { Box, Stack, Typography } from '@mui/material'

export interface LadderBid {
  player: string
  amount: number
}

interface Props {
  bids: LadderBid[]
  /** Sealed bids sit at the floor until the iteration resolves. */
  revealed: boolean
  /** Axis ceiling. Defaults to a round number above the highest bid. */
  scaleMax?: number
}

/** Lanes keep close bids from colliding without moving them off their value. */
const LANES = 3
const MIN_GAP_PCT = 13

interface PlacedBid extends LadderBid {
  pct: number
  lane: number
}

function place(bids: LadderBid[], scaleMax: number): PlacedBid[] {
  const lastInLane = Array<number>(LANES).fill(-Infinity)

  return [...bids]
    .sort((a, b) => a.amount - b.amount)
    .map((bid) => {
      const pct = scaleMax > 0 ? Math.min(100, (bid.amount / scaleMax) * 100) : 0
      let lane = lastInLane.findIndex((last) => pct - last > MIN_GAP_PCT)
      if (lane === -1) lane = 0
      lastInLane[lane] = pct
      return { ...bid, pct, lane }
    })
}

function roundedCeiling(highest: number): number {
  if (highest <= 0) return 10
  const magnitude = 10 ** Math.floor(Math.log10(highest))
  return Math.ceil((highest * 1.15) / magnitude) * magnitude
}

/**
 * The sealed-bid reveal.
 *
 * Every agent commits a number in the dark, so the story is the spread of
 * those numbers and the margin between the hammer price and the runner-up —
 * not the order they arrived in. Horizontal position is bid magnitude; the
 * brass line is where the hammer fell.
 */
export function BidLadder({ bids, revealed, scaleMax }: Props) {
  const sorted = useMemo(() => [...bids].sort((a, b) => b.amount - a.amount), [bids])
  const highest = sorted[0]
  const runnerUp = sorted[1]
  const max = scaleMax ?? roundedCeiling(highest?.amount ?? 0)
  const placed = useMemo(() => place(bids, max), [bids, max])

  if (bids.length === 0) {
    return (
      <Typography sx={{ color: 'text.secondary', py: 4, textAlign: 'center' }}>
        No agents have bid on this lot yet.
      </Typography>
    )
  }

  const hammerPct = revealed && highest ? Math.min(100, (highest.amount / max) * 100) : 0
  const margin = highest && runnerUp ? highest.amount - runnerUp.amount : null

  // Height follows the lanes actually in use, so a two-bid lot does not leave a
  // hole where a crowded one would need the room.
  const lanesUsed = Math.max(...placed.map((bid) => bid.lane)) + 1
  const plotHeight = 24 + 40 + (lanesUsed - 1) * 26

  return (
    <Stack spacing={2.5}>
      <Stack
        direction="row"
        sx={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}
      >
        <Typography variant="overline" sx={{ color: revealed ? 'primary.main' : 'text.secondary' }}>
          {revealed ? 'Hammer down' : `${bids.length} sealed bids`}
        </Typography>
        {revealed && highest && (
          <Typography variant="overline" sx={{ color: 'text.secondary' }} data-figure>
            {margin !== null
              ? `${highest.player} won by ${margin} over ${runnerUp!.player}`
              : `${highest.player} won unopposed`}
          </Typography>
        )}
      </Stack>

      <Box
        role="group"
        aria-label={
          revealed
            ? `Revealed bids. Hammer price ${highest?.amount} by ${highest?.player}.`
            : `${bids.length} sealed bids awaiting reveal.`
        }
        sx={{
          position: 'relative',
          height: plotHeight,
          // Markers are centred on their value, so the plot is inset to leave
          // room for a label sitting at either end of the axis.
          mx: { xs: 3, sm: 4 },
        }}
      >
        {/* Bid markers */}
        {placed.map((bid, index) => {
          const isWinner = revealed && highest && bid.player === highest.player
          return (
            <Box
              key={bid.player}
              sx={{
                position: 'absolute',
                bottom: 24,
                left: `${revealed ? bid.pct : 0}%`,
                transform: 'translateX(-50%)',
                transition: 'left 700ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 400ms ease',
                transitionDelay: `${index * 70}ms`,
                opacity: revealed ? 1 : 0.55,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                pointerEvents: 'none',
              }}
            >
              <Stack
                sx={{
                  alignItems: 'center',
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 1,
                  border: 1,
                  borderStyle: revealed ? 'solid' : 'dashed',
                  borderColor: isWinner ? 'primary.main' : 'divider',
                  backgroundColor: 'background.paper',
                  mb: `${bid.lane * 26}px`,
                }}
              >
                <Typography
                  variant="caption"
                  data-figure
                  sx={{
                    color: isWinner ? 'primary.main' : 'text.secondary',
                    fontWeight: isWinner ? 500 : 400,
                    whiteSpace: 'nowrap',
                    lineHeight: 1.5,
                  }}
                >
                  {bid.player}
                  {revealed && ` · ${bid.amount}`}
                </Typography>
              </Stack>
              {/* Stem down to the axis */}
              <Box
                sx={{
                  width: '1px',
                  height: `${bid.lane * 26 + 10}px`,
                  mt: `-${bid.lane * 26}px`,
                  backgroundColor: isWinner ? 'primary.main' : 'divider',
                }}
              />
            </Box>
          )
        })}

        {/* Hammer line */}
        {revealed && highest && (
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              bottom: 12,
              left: `${hammerPct}%`,
              width: '2px',
              height: 22,
              backgroundColor: 'primary.main',
              transform: 'translateX(-50%)',
              transition: 'left 700ms cubic-bezier(0.22, 0.61, 0.36, 1)',
            }}
          />
        )}

        {/* Axis */}
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 24,
            height: '1px',
            backgroundColor: 'divider',
          }}
        />

        {/* Axis labels */}
        <Stack
          direction="row"
          sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, justifyContent: 'space-between' }}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((step) => (
            <Typography
              key={step}
              variant="overline"
              data-figure
              sx={{ color: 'text.disabled', fontSize: '0.625rem' }}
            >
              {Math.round(max * step)}
            </Typography>
          ))}
        </Stack>
      </Box>
    </Stack>
  )
}
