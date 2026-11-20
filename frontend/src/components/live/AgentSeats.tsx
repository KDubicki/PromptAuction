import { Box, Button, Stack, Typography } from '@mui/material'

import { TONE_COLOR, describeCall } from '../../liveGame'
import { fadeUp, ripple } from '../../motion'
import { initials } from '../../replay'
import type { OwnedItem, RosterEntry, SessionBid } from '../../types'

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

export function Monogram({ name, active }: { name: string; active: boolean }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: 36,
        height: 36,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        fontFamily: (t) => t.typography.h1.fontFamily,
        fontWeight: 800,
        fontSize: '0.8125rem',
        letterSpacing: '0.02em',
        bgcolor: active ? 'primary.main' : 'action.selected',
        color: active ? 'primary.contrastText' : 'text.primary',
        transition: 'background-color 300ms ease',
        ...(active ? ripple('rgba(214, 162, 83, 0.55)') : {}),
      }}
    >
      {initials(name)}
    </Box>
  )
}

interface SeatProps {
  entry: RosterEntry
  startBudget: number
  leading: boolean
  followed: boolean
  call: SessionBid | undefined
  waiting: boolean
  onFollow?: () => void
  onInspect?: (call: SessionBid) => void
}

function Seat({ entry, startBudget, leading, followed, call, waiting, onFollow, onInspect }: SeatProps) {
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
        border: followed ? 2 : 1,
        borderColor: followed ? 'secondary.main' : leading ? 'primary.main' : 'divider',
        bgcolor: 'background.paper',
        boxShadow: (t) => (leading ? `inset 0 3px 0 ${t.palette.primary.main}` : 'none'),
        transition: 'border-color 300ms ease, box-shadow 300ms ease',
        minWidth: 0,
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
        <Monogram key={leading ? 'lead' : 'idle'} name={entry.name} active={leading} />
        <Stack sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h5" component="h3" sx={{ overflowWrap: 'anywhere', lineHeight: 1.2 }}>
            {entry.name}
          </Typography>
          <Typography variant="overline" data-figure sx={{ color: leading ? 'primary.main' : 'text.secondary' }}>
            {leading ? 'Leading' : entry.version ? `Prompt v${entry.version}` : 'Agent'}
          </Typography>
        </Stack>
        {onFollow && (
          <Button
            size="small"
            variant={followed ? 'contained' : 'outlined'}
            color="secondary"
            onClick={onFollow}
            aria-pressed={followed}
            aria-label={followed ? `Stop following ${entry.name}` : `Follow ${entry.name}`}
          >
            {followed ? 'Following' : 'Follow'}
          </Button>
        )}
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
          <Stack key={`${call.lot_number}-${call.round}`} spacing={0.75} sx={fadeUp(0, 6)}>
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
            {onInspect && (
              <Box>
                <Button size="small" onClick={() => onInspect(call)} aria-label={`Why ${entry.name} answered this way`} sx={{ px: 0, minHeight: 28 }}>
                  Why?
                </Button>
              </Box>
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
  roster: RosterEntry[]
  startBudget: number
  calls: Map<string, SessionBid>
  leaderRef: string | null
  followedRef?: string | null
  waiting?: boolean
  onFollow?: (playerRef: string) => void
  onInspect?: (call: SessionBid) => void
}

/** The bidders in the room, each with their budget, their haul and their last word. */
export function AgentSeats({ roster, startBudget, calls, leaderRef, followedRef = null, waiting = false, onFollow, onInspect }: Props) {
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
      {roster.map((entry) => (
        <Seat
          key={entry.player_ref}
          entry={entry}
          startBudget={startBudget}
          leading={entry.player_ref === leaderRef}
          followed={entry.player_ref === followedRef}
          call={calls.get(entry.player_ref) ?? calls.get(entry.name)}
          waiting={waiting}
          onFollow={onFollow ? () => onFollow(entry.player_ref) : undefined}
          onInspect={onInspect}
        />
      ))}
    </Box>
  )
}
