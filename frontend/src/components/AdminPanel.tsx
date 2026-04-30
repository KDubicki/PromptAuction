import {
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material'

import { usePrompts, useUpdatePromptStatus } from '../api/hooks'
import type { PromptSubmission } from '../types'

function PromptCard({ prompt }: { prompt: PromptSubmission }) {
  const updateStatus = useUpdatePromptStatus()

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="subtitle1">Player: {prompt.player_id}</Typography>
          <Typography variant="body2">{prompt.prompt_text}</Typography>
          <Chip size="small" label={prompt.status} />
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="contained"
              onClick={() => updateStatus.mutate({ id: prompt.id, status: 'accepted' })}
            >
              Accept
            </Button>
            <Button
              size="small"
              color="error"
              variant="outlined"
              onClick={() => updateStatus.mutate({ id: prompt.id, status: 'rejected' })}
            >
              Reject
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

export function AdminPanel() {
  const { data: pendingPrompts = [] } = usePrompts('pending')

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Admin Panel</Typography>
      <Typography variant="body2" color="text.secondary">
        Review pending prompt submissions before starting a game.
      </Typography>
      {pendingPrompts.length === 0 && (
        <Typography color="text.secondary">No pending prompts to review.</Typography>
      )}
      {pendingPrompts.map((prompt) => (
        <PromptCard key={prompt.id} prompt={prompt} />
      ))}
      <Button variant="contained">Initialize Game Session</Button>
    </Stack>
  )
}
