import { Box, Button, Card, Stack, Typography } from '@mui/material'

import { Panel } from './Panel'
import { usePrompts, useUpdatePromptStatus } from '../api/hooks'
import type { PromptSubmission } from '../types'

function PromptCard({ prompt }: { prompt: PromptSubmission }) {
  const updateStatus = useUpdatePromptStatus()
  const pending = updateStatus.isPending

  return (
    <Card>
      <Stack spacing={2} sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack
          direction="row"
          sx={{ gap: 1.5, alignItems: 'baseline', justifyContent: 'space-between' }}
        >
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            {prompt.player_id}
          </Typography>
          <Typography variant="overline" sx={{ color: 'text.disabled' }}>
            {prompt.status}
          </Typography>
        </Stack>

        {/* The prompt is the artefact under review — give it room. */}
        <Typography
          sx={{
            borderLeft: 2,
            borderColor: 'divider',
            pl: 2,
            overflowWrap: 'anywhere',
            color: 'text.primary',
          }}
        >
          {prompt.prompt_text}
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="contained"
            disabled={pending}
            onClick={() => updateStatus.mutate({ id: prompt.id, status: 'accepted' })}
          >
            Accept
          </Button>
          <Button
            variant="outlined"
            color="error"
            disabled={pending}
            onClick={() => updateStatus.mutate({ id: prompt.id, status: 'rejected' })}
          >
            Reject
          </Button>
        </Stack>
      </Stack>
    </Card>
  )
}

export function AdminPanel() {
  const { data: pendingPrompts = [] } = usePrompts('pending')

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h3" component="h1">
          Admin
        </Typography>
        <Typography sx={{ color: 'text.secondary', maxWidth: '60ch' }}>
          Review pending prompts before the round opens. Accepted prompts become bidding agents.
        </Typography>
      </Stack>

      <Panel
        title="Review queue"
        slug={`${pendingPrompts.length} pending`}
        action={<Button variant="contained">Initialize session</Button>}
      >
        {pendingPrompts.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography sx={{ color: 'text.secondary' }}>
              The queue is clear. New submissions land here for review.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {pendingPrompts.map((prompt) => (
              <PromptCard key={prompt.id} prompt={prompt} />
            ))}
          </Stack>
        )}
      </Panel>
    </Stack>
  )
}
