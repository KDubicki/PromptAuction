import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'

import { apiErrorMessage, usePlayer } from '../api/hooks'
import type { PromptSource } from '../types'

const SOURCE_LABELS: Record<PromptSource, string> = {
  admin: 'Added by admin',
  google_forms: 'Google Form',
  webhook: 'Webhook',
  migration: 'Imported',
}

interface Props {
  playerId: string | null
  onClose: () => void
}

export function PlayerHistoryDialog({ playerId, onClose }: Props) {
  const { data: player, isLoading, isError, error } = usePlayer(playerId)

  return (
    <Dialog open={playerId !== null} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{player ? `${player.name} · prompt history` : 'Prompt history'}</DialogTitle>
      <DialogContent>
        {isLoading && <Typography sx={{ color: 'text.secondary' }}>Loading…</Typography>}
        {isError && <Alert severity="error">{apiErrorMessage(error)}</Alert>}
        {player && (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {player.versions.map((v) => (
              <Box
                component="li"
                key={v.id}
                sx={{ py: 1.5, borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 0 } }}
              >
                <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}>
                  <Typography variant="overline" data-figure>
                    v{v.version}
                  </Typography>
                  {v.id === player.current_version?.id && <Chip size="small" color="primary" label="Current" />}
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {v.status} · {SOURCE_LABELS[v.source]}
                    {v.created_at ? ` · ${new Date(v.created_at).toLocaleString()}` : ''}
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {v.prompt_text}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
