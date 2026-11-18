import { Box, Button, Stack, Typography } from '@mui/material'

import { GoogleFormSourcePanel } from './GoogleFormSourcePanel'
import { Panel } from './Panel'
import { usePrompts, useUpdatePromptStatus } from '../api/hooks'
import type { PromptSubmission } from '../types'

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
        {/* The prompt is the thing under review — full body size, readable measure. */}
        <Typography sx={{ maxWidth: '72ch', overflowWrap: 'anywhere' }}>
          {prompt.prompt_text}
        </Typography>
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

      <GoogleFormSourcePanel />

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
    </Stack>
  )
}
