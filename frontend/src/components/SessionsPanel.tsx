import { useState } from 'react'
import { Alert, Box, Button, ButtonBase, Stack, TextField, Typography } from '@mui/material'

import { Panel } from './Panel'
import { SessionSettingsFields } from './SessionSettingsFields'
import { DEFAULT_SETTINGS, parseDraft, toDraft } from './sessionSettings'
import { apiErrorMessage, useCreateGameSession, useGameSessions } from '../api/hooks'
import { pluralize } from '../plural'
import type { GameStatus } from '../types'

interface Props {
  selectedId: string | null
  onSelect: (id: string) => void
}

const statusLabels: Record<GameStatus, string> = {
  pending: 'Waiting to start',
  running: 'Running',
  paused: 'Paused',
  completed: 'Completed',
}

export function SessionsPanel({ selectedId, onSelect }: Props) {
  const { data: sessions = [], isLoading, isError, error } = useGameSessions()
  const create = useCreateGameSession()
  const [name, setName] = useState('')
  const [draft, setDraft] = useState(toDraft(DEFAULT_SETTINGS))
  const [createError, setCreateError] = useState<string | null>(null)

  const trimmed = name.trim()
  const settings = parseDraft(draft)
  const canCreate = trimmed.length >= 1 && trimmed.length <= 200 && settings !== null && !create.isPending

  const submit = async () => {
    if (!canCreate || settings === null) return
    setCreateError(null)
    try {
      const created = await create.mutateAsync({ name: trimmed, settings })
      setName('')
      onSelect(created.id)
    } catch (e) {
      setCreateError(apiErrorMessage(e))
    }
  }

  return (
    <Panel title="Sessions" slug={pluralize(sessions.length, 'session')} flush>
      <Stack
        component="form"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
        sx={{ gap: 1.5, p: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Stack direction="row" sx={{ gap: 1, alignItems: 'flex-start' }}>
        <TextField
          size="small"
          label="Session name"
          id="session-name"
          slotProps={{ htmlInput: { 'aria-label': 'Session name' } }}
          value={name}
          onChange={(event) => setName(event.target.value)}
          sx={{ flex: 1, minWidth: 0 }}
        />
        <Button type="submit" variant="outlined" disabled={!canCreate} sx={{ flexShrink: 0, height: 40 }}>
          New session
        </Button>
        </Stack>
        <SessionSettingsFields draft={draft} onChange={setDraft} disabled={create.isPending} />
      </Stack>
      {createError && <Alert severity="error" sx={{ m: 2 }}>{createError}</Alert>}
      {isError && <Alert severity="error" sx={{ m: 2 }}>{apiErrorMessage(error)}</Alert>}
      {!isLoading && !isError && sessions.length === 0 && (
        <Typography sx={{ color: 'text.secondary', p: 2.5 }}>No sessions yet. Create one above.</Typography>
      )}
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {sessions.map((session) => (
          <Box
            component="li"
            key={session.id}
            sx={{ borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}
          >
            <ButtonBase
              onClick={() => onSelect(session.id)}
              aria-current={session.id === selectedId ? 'true' : undefined}
              sx={{
                display: 'flex',
                width: '100%',
                textAlign: 'left',
                gap: 1.5,
                px: { xs: 2, sm: 2.5 },
                py: 1.5,
                alignItems: 'center',
                bgcolor: session.id === selectedId ? 'action.selected' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{session.name}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {statusLabels[session.status]}
                </Typography>
              </Box>
              <Typography variant="caption" data-figure sx={{ color: 'text.secondary', flexShrink: 0 }}>
                {pluralize(session.roster.length, 'player')}
              </Typography>
            </ButtonBase>
          </Box>
        ))}
      </Box>
    </Panel>
  )
}
