import { useState } from 'react'
import { Alert, Box, Button, Stack, Typography } from '@mui/material'

import { AddPlayersDialog } from './AddPlayersDialog'
import { Panel } from './Panel'
import { SessionSettingsFields } from './SessionSettingsFields'
import { parseDraft, toDraft } from './sessionSettings'
import { apiErrorMessage, useRemoveFromRoster, useStartGameSession, useUpdateSessionSettings } from '../api/hooks'
import { pluralize } from '../plural'
import type { GameSession, RosterEntry } from '../types'

/** Keyed by session so mutation errors and dialog state never leak between sessions. */
export function SessionRoster({ session }: { session: GameSession }) {
  return <SessionRosterBody key={session.id} session={session} />
}

function requiredItemCount(entry: RosterEntry): number {
  return new Set(entry.items.filter((owned) => owned.required).map((owned) => owned.item)).size
}

function AuctionStatus({ session }: { session: GameSession }) {
  const { auction, settings } = session
  if (!auction) return null
  const lot = session.lots.find((l) => l.number === auction.lot_number)
  return (
    <Stack spacing={0.5} sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      {lot && (
        <Typography data-figure sx={{ fontWeight: 600 }}>
          {`Lot ${lot.number} of ${settings.lots_count} · ${lot.item} · quality ${lot.quality} · ${lot.required ? 'required' : 'not required'}`}
        </Typography>
      )}
      <Typography variant="body2" data-figure sx={{ color: 'text.secondary' }}>
        {`Round ${auction.current_round} of ${settings.max_rounds}`}
      </Typography>
      <Typography variant="body2" data-figure sx={{ color: 'text.secondary' }}>
        {auction.leader_name ? `Highest bid ${auction.highest_bid} · ${auction.leader_name}` : 'No bids yet'}
      </Typography>
    </Stack>
  )
}

function SettingsEditor({ session }: { session: GameSession }) {
  const save = useUpdateSessionSettings()
  const [draft, setDraft] = useState(toDraft(session.settings))
  const parsed = parseDraft(draft)
  const unchanged = JSON.stringify(draft) === JSON.stringify(toDraft(session.settings))
  return (
    <Stack spacing={1.5} sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
      <SessionSettingsFields draft={draft} onChange={setDraft} disabled={save.isPending} />
      <Box>
        <Button
          size="small"
          variant="outlined"
          disabled={parsed === null || unchanged || save.isPending}
          onClick={() => parsed && save.mutate({ sessionId: session.id, settings: parsed })}
        >
          Save settings
        </Button>
      </Box>
      {save.isError && <Alert severity="error">{apiErrorMessage(save.error)}</Alert>}
    </Stack>
  )
}

function SessionRosterBody({ session }: { session: GameSession }) {
  const start = useStartGameSession()
  const remove = useRemoveFromRoster()
  const [adding, setAdding] = useState(false)
  const isPending = session.status === 'pending'

  return (
    <Panel
      title={session.name}
      slug={pluralize(session.roster.length, 'player')}
      action={
        isPending && (
          <Stack direction="row" sx={{ gap: 1 }}>
            <Button size="small" variant="outlined" onClick={() => setAdding(true)}>
              Add players
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={session.start_blockers.length > 0 || start.isPending}
              onClick={() => start.mutate(session.id)}
            >
              Start session
            </Button>
          </Stack>
        )
      }
      flush
    >
      {isPending && session.start_blockers.length > 0 && (
        <Alert severity="warning" sx={{ m: 2 }}>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {session.start_blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </Box>
        </Alert>
      )}
      {isPending ? <SettingsEditor session={session} /> : <AuctionStatus session={session} />}
      {session.status === 'paused' && session.pause_reason && (
        <Alert severity="warning" sx={{ m: 2 }}>{session.pause_reason}</Alert>
      )}
      {start.isError && <Alert severity="error" sx={{ m: 2 }}>{apiErrorMessage(start.error)}</Alert>}
      {remove.isError && <Alert severity="error" sx={{ m: 2 }}>{apiErrorMessage(remove.error)}</Alert>}
      {session.roster.length === 0 && (
        <Typography sx={{ color: 'text.secondary', p: 2.5 }}>No players in this session yet.</Typography>
      )}
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {session.roster.map((entry) => (
          <Box
            component="li"
            key={entry.player_ref}
            sx={{
              px: { xs: 2, sm: 2.5 },
              py: 1.5,
              borderBottom: 1,
              borderColor: 'divider',
              '&:last-of-type': { borderBottom: 0 },
            }}
          >
            <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{entry.name}</Typography>
                {isPending ? (
                  entry.current_version === null ? (
                    <Typography variant="body2" sx={{ color: 'error.main' }}>
                      No accepted prompt yet
                    </Typography>
                  ) : (
                    <Typography variant="body2" data-figure sx={{ color: 'text.secondary' }}>
                      Current v{entry.current_version}
                    </Typography>
                  )
                ) : (
                  <Typography variant="body2" data-figure sx={{ color: 'text.secondary' }}>
                    Plays v{entry.version}
                  </Typography>
                )}
              </Box>
              {entry.budget !== null && (
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography variant="body2" data-figure>{`${entry.budget} pts`}</Typography>
                  <Typography variant="caption" data-figure sx={{ color: 'text.secondary' }}>
                    {pluralize(requiredItemCount(entry), 'required item')}
                  </Typography>
                </Box>
              )}
              {isPending && (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  aria-label={`Remove ${entry.name}`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ sessionId: session.id, playerId: entry.player_ref })}
                >
                  Remove
                </Button>
              )}
            </Stack>
          </Box>
        ))}
      </Box>
      <AddPlayersDialog session={session} open={adding && isPending} onClose={() => setAdding(false)} />
    </Panel>
  )
}
