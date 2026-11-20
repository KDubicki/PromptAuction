import { Box, Stack, Typography } from '@mui/material'

import { Panel } from '../Panel'
import { TONE_COLOR, describeCall, formatSeconds, groupRounds, playerKey } from '../../liveGame'
import { pluralize } from '../../plural'
import type { SessionBid } from '../../types'

interface Props {
  lotNumber: number
  bids: SessionBid[]
  maxRounds: number
  /** Agent whose calls stand out; matched by player ref or name. */
  followedKey?: string | null
}

function Call({ bid, followed }: { bid: SessionBid; followed: boolean }) {
  const summary = describeCall(bid)
  const highlighted = summary.tone === 'lead' || summary.tone === 'won'
  return (
    <Box
      component="li"
      data-followed={followed || undefined}
      sx={{
        bgcolor: followed ? 'action.hover' : 'transparent',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr auto', sm: 'minmax(90px, 140px) minmax(120px, 190px) 1fr auto' },
        columnGap: 2,
        rowGap: 0.25,
        alignItems: 'baseline',
        px: { xs: 2, sm: 2.5 },
        py: 1.25,
        borderLeft: 3,
        borderColor: highlighted ? 'primary.main' : followed ? 'secondary.main' : 'transparent',
      }}
    >
      <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{bid.player_id}</Typography>
      <Typography sx={{ color: TONE_COLOR[summary.tone], fontWeight: highlighted ? 600 : 400, order: { xs: 3, sm: 0 } }}>
        {summary.text}
        {summary.tag && (
          <Box component="span" sx={{ typography: 'caption', ml: 1 }}>
            {summary.tag}
          </Box>
        )}
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontStyle: 'italic', color: 'text.secondary', gridColumn: { xs: '1 / -1', sm: 'auto' }, order: { xs: 4, sm: 0 } }}
      >
        {bid.reason ?? ''}
      </Typography>
      <Typography variant="caption" data-figure sx={{ color: 'text.disabled', textAlign: 'right', order: { xs: 2, sm: 0 } }}>
        {formatSeconds(bid.response_ms)}
      </Typography>
    </Box>
  )
}

/** Everything said on this lot, newest round on top. */
export function RoomTranscript({ lotNumber, bids, maxRounds, followedKey = null }: Props) {
  const rounds = groupRounds(bids)
  return (
    <Panel title={`Lot ${lotNumber}, round by round`} slug={pluralize(bids.length, 'call')} flush>
      {rounds.length === 0 ? (
        <Typography sx={{ color: 'text.secondary', p: 2.5 }}>
          No calls yet. Each round, every agent answers at once.
        </Typography>
      ) : (
        <Stack component="ol" reversed sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {rounds.map(({ round, calls }) => (
            <Box component="li" key={round} sx={{ borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
              <Typography
                variant="overline"
                component="h3"
                data-figure
                sx={{ display: 'block', px: { xs: 2, sm: 2.5 }, pt: 1.5, color: round === maxRounds ? 'error.main' : 'text.secondary' }}
              >
                {round === maxRounds ? `Round ${round}, final` : `Round ${round}`}
              </Typography>
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, pb: 0.5 }}>
                {calls.map((bid) => (
                  <Call
                    key={`${playerKey(bid)}-${bid.round}`}
                    bid={bid}
                    followed={followedKey !== null && (bid.player_ref === followedKey || bid.player_id === followedKey)}
                  />
                ))}
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </Panel>
  )
}
