import { useState } from 'react'
import { Alert, Box, Button, Stack, Typography } from '@mui/material'

import { GoogleFormSourcePanel } from './GoogleFormSourcePanel'
import { Panel } from './Panel'
import { PlayersPanel } from './PlayersPanel'
import { SessionRoster } from './SessionRoster'
import { SessionsPanel } from './SessionsPanel'
import { useGameSessions, usePrompts, useUpdatePromptStatus } from '../api/hooks'
import type { GameSession, PromptSubmission } from '../types'

const sourceLabels: Record<string, string> = {
  google_forms: 'from Google Form',
  webhook: 'via webhook',
}

function promptMeta(prompt: PromptSubmission): string {
  const origin = prompt.version === 1 ? 'New player' : `Version ${prompt.version}`
  const source = prompt.source ? sourceLabels[prompt.source] : undefined
  return source ? `${origin} · ${source}` : origin
}

function createdAt(session: GameSession): number {
  return session.created_at ? Date.parse(session.created_at) : 0
}

function newest(sessions: GameSession[]): GameSession | undefined {
  return sessions.reduce<GameSession | undefined>(
    (best, s) => (best === undefined || createdAt(s) > createdAt(best) ? s : best),
    undefined,
  )
}

function defaultSession(sessions: GameSession[]): GameSession | undefined {
  return newest(sessions.filter((s) => s.status === 'pending')) ?? newest(sessions)
}

function PromptRow({ prompt, last }: { prompt: PromptSubmission; last: boolean }) {
  const updateStatus = useUpdatePromptStatus()
  const pending = updateStatus.isPending

  return (
    <Stack
      component="li"
      direction={{ xs: 'column', md: 'row' }}
      sx={{
        gap: { xs: 1.5, md: 3 },
        alignItems: { md: 'center' },
        px: { xs: 2, sm: 2.5 },
        py: 2.25,
        borderBottom: last ? 0 : 1,
        borderColor: 'divider',
      }}
    >
      <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{prompt.player_id}</Typography>
        {prompt.version != null && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {promptMeta(prompt)}
          </Typography>
        )}
        {/* The prompt is the thing under review — full body size, readable measure. */}
        <Typography sx={{ maxWidth: '72ch', overflowWrap: 'anywhere' }}>
          {prompt.prompt_text}
        </Typography>
        {prompt.identity_warning === 'email_mismatch' && (
          <Alert severity="warning" sx={{ maxWidth: '72ch' }}>
            Email differs from this player's. Submitted with {prompt.email ?? 'no email'}.
          </Alert>
        )}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
        <Button
          variant="contained"
          disabled={pending}
          onClick={() => updateStatus.mutate({ id: prompt.id, status: 'accepted' })}
          sx={{ flex: { xs: 1, md: 'none' } }}
        >
          Accept
        </Button>
        <Button
          variant="outlined"
          color="error"
          disabled={pending}
          onClick={() => updateStatus.mutate({ id: prompt.id, status: 'rejected' })}
          sx={{ flex: { xs: 1, md: 'none' } }}
        >
          Reject
        </Button>
      </Stack>
    </Stack>
  )
}

export function AdminPanel() {
  const { data: pendingPrompts = [] } = usePrompts('pending')
  const { data: sessions = [] } = useGameSessions()
  const [chosenId, setChosenId] = useState<string | null>(null)

  const selected = sessions.find((s) => s.id === chosenId) ?? defaultSession(sessions)

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h3" component="h1">
          Admin
        </Typography>
        <Typography sx={{ color: 'text.secondary', maxWidth: '60ch' }}>
          Create a session, add players, and start it. Each player bids with the prompt version they had when the session started.
        </Typography>
      </Stack>

      <SessionsPanel selectedId={selected?.id ?? null} onSelect={setChosenId} />
      {selected && <SessionRoster session={selected} />}

      <PlayersPanel />

      <Panel title="Review queue" slug={`${pendingPrompts.length} pending`} flush>
        {pendingPrompts.length === 0 ? (
          <Box sx={{ px: 2.5, py: 5, textAlign: 'center' }}>
            <Typography sx={{ color: 'text.secondary' }}>
              The queue is clear. New submissions land here for review.
            </Typography>
          </Box>
        ) : (
          <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {pendingPrompts.map((prompt, index) => (
              <PromptRow key={prompt.id} prompt={prompt} last={index === pendingPrompts.length - 1} />
            ))}
          </Stack>
        )}
      </Panel>

      <GoogleFormSourcePanel />
    </Stack>
  )
}
