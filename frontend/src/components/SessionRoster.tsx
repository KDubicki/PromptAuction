import { useState } from 'react'
import { Alert, Box, Button, Stack, Typography } from '@mui/material'

import { AddPlayersDialog } from './AddPlayersDialog'
import { Panel } from './Panel'
import { apiErrorMessage, useRemoveFromRoster, useStartGameSession } from '../api/hooks'
import type { GameSession } from '../types'

export function SessionRoster({ session }: { session: GameSession }) {
  const start = useStartGameSession()
  const remove = useRemoveFromRoster()
  const [adding, setAdding] = useState(false)
  const isPending = session.status === 'pending'

  return (
    <Panel
      title={session.name}
      slug={`${session.roster.length} players`}
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
              {isPending && (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  aria-label={`Remove ${entry.name}`}
                  onClick={() => remove.mutate({ sessionId: session.id, playerId: entry.player_ref })}
                >
                  Remove
                </Button>
              )}
            </Stack>
          </Box>
        ))}
      </Box>
      <AddPlayersDialog session={session} open={adding} onClose={() => setAdding(false)} />
    </Panel>
  )
}
