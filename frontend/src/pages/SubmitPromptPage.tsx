import { useState } from 'react'
import { Box, Button, Chip, Stack, TextField, Typography } from '@mui/material'

import { Panel } from '../components/Panel'
import { useEntryForm, usePrompts } from '../api/hooks'
import type { PromptStatus } from '../types'

const GOOGLE_FORM_URL = import.meta.env.VITE_GOOGLE_FORM_URL as string | undefined

/** Google only renders a form inside an iframe when asked for the embedded variant. */
function embedUrl(responderUrl: string): string {
  const url = new URL(responderUrl)
  url.searchParams.set('embedded', 'true')
  return url.toString()
}

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
  const { data: entryForm } = useEntryForm()
  const formUrl = GOOGLE_FORM_URL || (entryForm ? embedUrl(entryForm.responder_url) : undefined)

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
        <Typography sx={{ color: 'text.secondary', maxWidth: '60ch' }}>
          Your prompt is your agent: give it a persona and tell it what to look at and how to bid.
        </Typography>
      </Stack>

      <Panel title="Entry form" flush>
        {formUrl ? (
          <Box
            component="iframe"
            src={formUrl}
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
              An admin connects the Google Form in the Admin panel.
            </Typography>
          </Stack>
        )}
      </Panel>

      <PromptStatusChecker />
    </Stack>
  )
}
