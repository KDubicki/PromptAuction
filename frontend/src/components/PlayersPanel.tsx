import { useState } from 'react'
import { Alert, Box, Button, Stack, Typography } from '@mui/material'

import { Panel } from './Panel'
import { PlayerDialog } from './PlayerDialog'
import { PlayerHistoryDialog } from './PlayerHistoryDialog'
import { apiErrorMessage, useDeletePlayer, usePlayers } from '../api/hooks'
import { pluralize } from '../plural'
import type { Player } from '../types'

type DialogState = { kind: 'closed' } | { kind: 'edit'; player: Player | null }

export function PlayersPanel() {
  const { data: players = [], isLoading, isError, error } = usePlayers()
  const remove = useDeletePlayer()
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' })
  const [historyId, setHistoryId] = useState<string | null>(null)

  const confirmDelete = (player: Player) => {
    if (window.confirm(`Delete ${player.name} and all prompt versions?`)) remove.mutate(player.id)
  }

  return (
    <Panel
      title="Players"
      slug={pluralize(players.length, 'player')}
      action={
        <Button variant="contained" size="small" onClick={() => setDialog({ kind: 'edit', player: null })}>
          Add player
        </Button>
      }
      flush
    >
      {isError && <Alert severity="error" sx={{ m: 2 }}>{apiErrorMessage(error)}</Alert>}
      {remove.isError && <Alert severity="error" sx={{ m: 2 }}>{apiErrorMessage(remove.error)}</Alert>}
      {!isLoading && !isError && players.length === 0 && (
        <Typography sx={{ color: 'text.secondary', p: 2.5 }}>
          No players yet. Add one, or connect the entry form.
        </Typography>
      )}
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {players.map((player) => {
          const current = player.current_version
          return (
            <Box
              component="li"
              key={player.id}
              sx={{
                px: { xs: 2, sm: 2.5 },
                py: 1.5,
                borderBottom: 1,
                borderColor: 'divider',
                '&:last-of-type': { borderBottom: 0 },
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5, alignItems: { sm: 'center' } }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{player.name}</Typography>
                  {current ? (
                    <Stack direction="row" sx={{ gap: 1, alignItems: 'baseline' }}>
                      <Typography variant="caption" data-figure sx={{ color: 'text.secondary', flexShrink: 0 }}>
                        v{current.version}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                          overflowWrap: 'anywhere',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {current.prompt_text}
                      </Typography>
                    </Stack>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                      No accepted prompt yet
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" sx={{ gap: 1, flexShrink: 0 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    aria-label={`Edit ${player.name}`}
                    onClick={() => setDialog({ kind: 'edit', player })}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    aria-label={`History ${player.name}`}
                    onClick={() => setHistoryId(player.id)}
                  >
                    History
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    aria-label={`Delete ${player.name}`}
                    disabled={remove.isPending}
                    onClick={() => confirmDelete(player)}
                  >
                    Delete
                  </Button>
                </Stack>
              </Stack>
            </Box>
          )
        })}
      </Box>
      <PlayerDialog
        open={dialog.kind === 'edit'}
        player={dialog.kind === 'edit' ? dialog.player : null}
        onClose={() => setDialog({ kind: 'closed' })}
      />
      <PlayerHistoryDialog playerId={historyId} onClose={() => setHistoryId(null)} />
    </Panel>
  )
}
