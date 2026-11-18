import { useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material'

import { apiErrorMessage, useAddPromptVersion, useCreatePlayer, useUpdatePlayer } from '../api/hooks'
import type { Player } from '../types'

interface Props {
  open: boolean
  player: Player | null
  onClose: () => void
}

function PlayerForm({ player, onClose }: { player: Player | null; onClose: () => void }) {
  const create = useCreatePlayer()
  const update = useUpdatePlayer()
  const addVersion = useAddPromptVersion()
  const [name, setName] = useState(player?.name ?? '')
  const [email, setEmail] = useState(player?.email ?? '')
  const [prompt, setPrompt] = useState(player?.current_version?.prompt_text ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const nextVersion = (player?.current_version?.version ?? 0) + 1
  const canSubmit = name.trim() !== '' && (player !== null || prompt.trim() !== '') && !saving

  const submit = async () => {
    setError(null)
    setSaving(true)
    try {
      if (player === null) {
        await create.mutateAsync({
          name: name.trim(),
          email: email.trim() || undefined,
          prompt_text: prompt.trim(),
        })
      } else {
        const profileChanged = name.trim() !== player.name || email.trim() !== (player.email ?? '')
        const promptChanged = prompt.trim() !== (player.current_version?.prompt_text ?? '').trim()
        if (profileChanged) {
          await update.mutateAsync({ id: player.id, name: name.trim(), email: email.trim() || undefined })
        }
        if (promptChanged && prompt.trim()) {
          await addVersion.mutateAsync({ id: player.id, prompt_text: prompt.trim() })
        }
      }
      onClose()
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DialogTitle>{player ? 'Edit player' : 'Add player'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Nick" value={name} onChange={(e) => setName(e.target.value)} autoFocus fullWidth />
          <TextField
            label="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
          />
          <TextField
            label="Prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            multiline
            minRows={4}
            fullWidth
            helperText={player ? `Saving a changed prompt creates version ${nextVersion}.` : undefined}
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit}>
          {player ? 'Save' : 'Add player'}
        </Button>
      </DialogActions>
    </>
  )
}

export function PlayerDialog({ open, player, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && <PlayerForm key={player?.id ?? 'new'} player={player} onClose={onClose} />}
    </Dialog>
  )
}
