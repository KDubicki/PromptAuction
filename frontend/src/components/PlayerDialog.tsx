import { useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material'

import { apiErrorMessage, useAddPromptVersion, useCreatePlayer, useUpdatePlayer } from '../api/hooks'
import type { Player } from '../types'

interface Props {
  open: boolean
  player: Player | null
  onClose: () => void
}

interface FormProps {
  player: Player | null
  saving: boolean
  setSaving: (saving: boolean) => void
  onClose: () => void
}

const PROMPT_HELPER = 'Give your agent a persona and tell it what to check and how to bid.'

function PlayerForm({ player, saving, setSaving, onClose }: FormProps) {
  const create = useCreatePlayer()
  const update = useUpdatePlayer()
  const addVersion = useAddPromptVersion()
  const [name, setName] = useState(player?.name ?? '')
  const [email, setEmail] = useState(player?.email ?? '')
  const [prompt, setPrompt] = useState(player?.current_version?.prompt_text ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState({ name: player?.name ?? '', email: player?.email ?? '' })

  const nextVersion = (player?.latest_version ?? 0) + 1
  const trimmedName = name.trim()
  const trimmedEmail = email.trim()
  const trimmedPrompt = prompt.trim()
  const promptChanged = trimmedPrompt !== (player?.current_version?.prompt_text ?? '').trim()

  const nameError = trimmedName.length < 1 || trimmedName.length > 100 ? 'Nick must be 1–100 characters.' : null
  const emailError = trimmedEmail.length > 320 ? 'Email must be at most 320 characters.' : null
  const promptError =
    (player === null || promptChanged) && (trimmedPrompt.length < 3 || trimmedPrompt.length > 2000)
      ? 'Prompt must be 3–2000 characters.'
      : null
  const canSubmit = !nameError && !emailError && !promptError && !saving

  const submit = async () => {
    setError(null)
    setSaving(true)
    let profileApplied = false
    try {
      if (player === null) {
        await create.mutateAsync({
          name: trimmedName,
          email: trimmedEmail || undefined,
          prompt_text: trimmedPrompt,
        })
      } else {
        const nameChanged = trimmedName !== saved.name
        const emailChanged = trimmedEmail !== saved.email
        if (nameChanged || emailChanged) {
          await update.mutateAsync({
            id: player.id,
            ...(nameChanged && { name: trimmedName }),
            ...(emailChanged && { email: trimmedEmail }),
          })
          profileApplied = true
          setSaved({ name: trimmedName, email: trimmedEmail })
        }
        if (promptChanged) {
          await addVersion.mutateAsync({ id: player.id, prompt_text: trimmedPrompt })
        }
      }
      onClose()
    } catch (e) {
      const message = apiErrorMessage(e)
      setError(
        profileApplied
          ? `Saved the nick and email, but the new prompt version failed: ${message}`
          : message,
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DialogTitle>{player ? 'Edit player' : 'Add player'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Nick" value={name} onChange={(e) => setName(e.target.value)} autoFocus fullWidth
            error={!!nameError && name !== ''}
            helperText={name !== '' && nameError ? nameError : undefined}
          />
          <TextField
            label="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            error={!!emailError}
            helperText={emailError ?? undefined}
          />
          <TextField
            label="Agent prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            multiline
            minRows={4}
            fullWidth
            error={!!promptError && prompt !== ''}
            helperText={
              promptError && prompt !== ''
                ? promptError
                : player
                  ? `${PROMPT_HELPER} Saving a changed prompt creates version ${nextVersion}.`
                  : PROMPT_HELPER
            }
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button disabled={saving} onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit}>
          {player ? 'Save' : 'Add player'}
        </Button>
      </DialogActions>
    </>
  )
}

export function PlayerDialog({ open, player, onClose }: Props) {
  const [saving, setSaving] = useState(false)
  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      {open && (
        <PlayerForm key={player?.id ?? 'new'} player={player} saving={saving} setSaving={setSaving} onClose={onClose} />
      )}
    </Dialog>
  )
}
