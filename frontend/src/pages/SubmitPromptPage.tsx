import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import { usePrompts } from '../api/hooks'

const GOOGLE_FORM_URL = import.meta.env.VITE_GOOGLE_FORM_URL as string | undefined

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
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>Check Your Submission Status</Typography>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <TextField
          size="small"
          label="Your Player ID"
          value={playerId}
          onChange={(e) => { setPlayerId(e.target.value); setSearching(false) }}
          onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
        />
        <Button
          variant="outlined"
          onClick={handleCheck}
          disabled={!playerId.trim() || isFetching}
        >
          {isFetching ? 'Checking...' : 'Check'}
        </Button>
      </Stack>

      {searching && filteredPrompts.length === 0 && (
        <Typography color="text.secondary">No submissions found for "{playerId}".</Typography>
      )}

      {filteredPrompts.map((p) => (
        <Stack key={p.id} direction="row" spacing={2} alignItems="center" sx={{ py: 0.5 }}>
          <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {p.prompt_text}
          </Typography>
          <Chip
            size="small"
            label={p.status}
            color={p.status === 'accepted' ? 'success' : p.status === 'rejected' ? 'error' : 'default'}
          />
        </Stack>
      ))}
    </Paper>
  )
}

export function SubmitPromptPage() {
  return (
    <Stack spacing={3}>
      <Typography variant="h5">Submit Your Prompt</Typography>
      <Alert severity="info">
        Submit a strategic prompt that will guide an AI agent to bid on items during the auction.
        Be creative — your prompt determines how aggressively or strategically your agent will bid!
      </Alert>

      <Paper sx={{ p: 2 }}>
        {GOOGLE_FORM_URL ? (
          <Box
            component="iframe"
            src={GOOGLE_FORM_URL}
            sx={{
              width: '100%',
              minHeight: 600,
              border: 'none',
              borderRadius: 1,
            }}
            title="Submit Prompt Form"
          />
        ) : (
          <Box
            sx={{
              width: '100%',
              minHeight: 300,
              border: '1px dashed',
              borderColor: 'divider',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 2,
              p: 3,
            }}
          >
            <Typography color="text.secondary" textAlign="center">
              Google Form not configured. Set <code>VITE_GOOGLE_FORM_URL</code> in your <code>.env</code> file.
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Example: VITE_GOOGLE_FORM_URL=https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform?embedded=true
            </Typography>
          </Box>
        )}
      </Paper>

      <Divider />

      <PromptStatusChecker />
    </Stack>
  )
}
