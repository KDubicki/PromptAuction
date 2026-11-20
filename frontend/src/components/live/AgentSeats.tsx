import { Box, Stack, Typography } from '@mui/material'

import { TONE_COLOR, describeCall } from '../../liveGame'
import type { GameSession, OwnedItem, RosterEntry, SessionBid } from '../../types'

function ItemTag({ item }: { item: OwnedItem }) {
  return (
    <Box
      component="li"
      title={item.required ? `${item.item}, quality ${item.quality}` : `${item.item}, quality ${item.quality}, not required`}
      sx={{
        typography: 'caption',
        px: 0.75,
        py: 0.25,
        borderRadius: 1,
        border: 1,
        borderStyle: item.required ? 'solid' : 'dashed',
        borderColor: 'divider',
        color: item.required ? 'text.primary' : 'text.disabled',
        textDecoration: item.required ? 'none' : 'line-through',
        whiteSpace: 'nowrap',
      }}
    >
      {item.item} {item.quality}
    </Box>
  )
}

interface SeatProps {
  entry: RosterEntry
  startBudget: number
  leading: boolean
  call: SessionBid | undefined
  waiting: boolean
}

function Seat({ entry, startBudget, leading, call, waiting }: SeatProps) {
  const budget = entry.budget ?? startBudget
  const spentPct = startBudget > 0 ? Math.min(100, ((startBudget - budget) / startBudget) * 100) : 0
  const summary = call ? describeCall(call) : null

  return (
    <Stack
      component="li"
      aria-label={`${entry.name}${leading ? ', leading' : ''}`}
      spacing={2}
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 3,
        border: 1,
        borderColor: leading ? 'primary.main' : 'divider',
        bgcolor: 'background.paper',
        boxShadow: (t) => (leading ? `inset 0 3px 0 ${t.palette.primary.main}` : 'none'),
        transition: 'border-color 300ms ease, box-shadow 300ms ease',
        minWidth: 0,
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="h5" component="h3" sx={{ overflowWrap: 'anywhere' }}>
          {entry.name}
        </Typography>
        <Typography variant="overline" data-figure sx={{ color: leading ? 'primary.main' : 'text.secondary', flexShrink: 0 }}>
          {leading ? 'Leading' : entry.version ? `Prompt v${entry.version}` : null}
        </Typography>
      </Stack>

      <Stack spacing={0.75}>
        <Typography data-figure sx={{ typography: 'caption', fontSize: '1.375rem', fontWeight: 500, lineHeight: 1 }}>
          {budget}
          <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.75rem', ml: 0.75 }}>
            of {startBudget} pts left
          </Box>
        </Typography>
        <Box aria-hidden sx={{ height: 4, borderRadius: 2, bgcolor: 'divider', overflow: 'hidden' }}>
          <Box sx={{ width: `${100 - spentPct}%`, height: '100%', bgcolor: 'text.secondary', transition: 'width 600ms ease' }} />
        </Box>
      </Stack>

      {entry.items.length > 0 ? (
        <Stack component="ul" direction="row" aria-label="Items won" sx={{ listStyle: 'none', m: 0, p: 0, gap: 0.75, flexWrap: 'wrap' }}>
          {entry.items.map((item) => (
            <ItemTag key={item.lot_number} item={item} />
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Nothing won yet
        </Typography>
      )}

      <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1.75, mt: 'auto !important' }}>
        {summary && call ? (
          <Stack spacing={0.75}>
            <Typography sx={{ fontWeight: 600, color: TONE_COLOR[summary.tone] }}>
              {summary.text}
              {summary.tag && (
                <Box component="span" sx={{ fontWeight: 400, ml: 1, typography: 'caption' }}>
                  {summary.tag}
                </Box>
              )}
            </Typography>
            {call.reason && (
              <Typography
                component="q"
                variant="body2"
                sx={{
                  fontStyle: 'italic',
                  color: 'text.secondary',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {call.reason}
              </Typography>
            )}
          </Stack>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {waiting ? 'Thinking about the first call' : 'No calls on this lot'}
          </Typography>
        )}
      </Box>
    </Stack>
  )
}

interface Props {
  session: GameSession
  calls: Map<string, SessionBid>
}

/** The bidders in the room, each with their budget, their haul and their last word. */
export function AgentSeats({ session, calls }: Props) {
  const leaderRef = session.auction?.leader_ref ?? null
  return (
    <Box
      component="ul"
      aria-label="Agents"
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0,
        display: 'grid',
        gap: { xs: 2, sm: 2.5 },
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
      }}
    >
      {session.roster.map((entry) => (
        <Seat
          key={entry.player_ref}
          entry={entry}
          startBudget={session.settings.budget}
          leading={entry.player_ref === leaderRef}
          call={calls.get(entry.player_ref) ?? calls.get(entry.name)}
          waiting={session.status === 'running'}
        />
      ))}
    </Box>
  )
}
