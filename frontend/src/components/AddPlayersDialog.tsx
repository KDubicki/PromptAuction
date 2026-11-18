import { useState } from 'react'
import { Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'

import { apiErrorMessage, useAddToRoster, usePlayers } from '../api/hooks'
import type { GameSession, Player } from '../types'

interface Props {
  session: GameSession
  open: boolean
  onClose: () => void
}

function AddPlayersForm({ session, onClose }: { session: GameSession; onClose: () => void }) {
  const { data: players = [] } = usePlayers()
  const addToRoster = useAddToRoster()
  const [selected, setSelected] = useState<Player[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const inRoster = new Set(session.roster.map((entry) => entry.player_ref))
  const options = players.filter((player) => !inRoster.has(player.id))

  const submit = async () => {
    setError(null)
    setSaving(true)
    try {
      for (const player of selected) {
        await addToRoster.mutateAsync({ sessionId: session.id, playerId: player.id })
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
      <DialogTitle>Add players to {session.name}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Autocomplete
          multiple
          sx={{ mt: 1 }}
          options={options}
          value={selected}
          onChange={(_, value) => setSelected(value)}
          getOptionLabel={(player) => player.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          noOptionsText="No players left to add"
          renderInput={(params) => <TextField {...params} label="Players" />}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={selected.length === 0 || saving} onClick={submit}>
          Add
        </Button>
      </DialogActions>
    </>
  )
}

export function AddPlayersDialog({ session, open, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <AddPlayersForm session={session} onClose={onClose} />
    </Dialog>
  )
}
