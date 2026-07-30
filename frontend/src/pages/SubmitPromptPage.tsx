import { useState } from 'react'
import { Box, Button, Chip, Stack, TextField, Typography } from '@mui/material'

import { Panel } from '../components/Panel'
import { usePrompts } from '../api/hooks'
import type { PromptStatus } from '../types'

const GOOGLE_FORM_URL = import.meta.env.VITE_GOOGLE_FORM_URL as string | undefined

const STATUS_COLOR: Record<PromptStatus, 'success' | 'error' | 'default'> = {
  accepted: 'success',
  rejected: 'error',
  pending: 'default',
}

function PromptStatusChecker() {
  const [playerId, setPlayerId] = useState('')
  const [searching, setSearching] = useState(false)

  const { data: prompts = [], refetch, isFetching } = usePrompts(undefined)

  const filteredPrompts = searching
    ? prompts.filter((p) => p.player_id.toLowerCase() === playerId.toLowerCase())
    : []

  const handleCheck = () => {
    setSearching(true)
    refetch()
  }

  return (
    <Panel title="Check your submission">
      <Stack spacing={2.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: 'stretch' }}>
          <TextField
            size="small"
            label="Your player ID"
            value={playerId}
            onChange={(e) => {
              setPlayerId(e.target.value)
              setSearching(false)
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
            sx={{ flex: 1, minWidth: 0 }}
          />
          <Button
            variant="outlined"
            onClick={handleCheck}
            disabled={!playerId.trim() || isFetching}
            sx={{ flexShrink: 0 }}
          >
            {isFetching ? 'Checking…' : 'Check'}
          </Button>
        </Stack>

        {searching && filteredPrompts.length === 0 && (
          <Typography sx={{ color: 'text.secondary' }}>
            Nothing found for “{playerId}”. Check the ID you submitted with.
          </Typography>
        )}

        {filteredPrompts.map((p) => (
          <Stack
            key={p.id}
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              borderTop: 1,
              borderColor: 'divider',
              pt: 2,
            }}
          >
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
              {p.prompt_text}
            </Typography>
            <Chip size="small" label={p.status} color={STATUS_COLOR[p.status]} />
          </Stack>
        ))}
      </Stack>
    </Panel>
  )
}

export function SubmitPromptPage() {
  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h3" component="h1">
          Submit a prompt
        </Typography>
        <Typography sx={{ color: 'text.secondary', maxWidth: '60ch' }}>
          Your prompt is the whole strategy. It drives an agent that bids blind against every other
          agent — it never sees their numbers, and they never see yours.
        </Typography>
      </Stack>

      <Panel title="Entry form" flush>
        {GOOGLE_FORM_URL ? (
          <Box
            component="iframe"
            src={GOOGLE_FORM_URL}
            title="Submit prompt form"
            sx={{
              display: 'block',
              width: '100%',
              height: { xs: 560, sm: 700 },
              border: 'none',
            }}
          />
        ) : (
          <Stack
            spacing={1.5}
            sx={{ alignItems: 'center', textAlign: 'center', px: { xs: 2, sm: 4 }, py: 6 }}
          >
            <Typography sx={{ color: 'text.secondary' }}>
              No entry form is configured yet.
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.disabled', maxWidth: '52ch' }}>
              Set <Box component="code">VITE_GOOGLE_FORM_URL</Box> in{' '}
              <Box component="code">frontend/.env</Box> to the form&apos;s embed URL, then rebuild.
            </Typography>
          </Stack>
        )}
      </Panel>

      <PromptStatusChecker />
    </Stack>
  )
}
