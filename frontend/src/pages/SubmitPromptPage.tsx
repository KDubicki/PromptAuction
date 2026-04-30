import { Alert, Box, Paper, Stack, Typography } from '@mui/material'

export function SubmitPromptPage() {
  return (
    <Stack spacing={3}>
      <Typography variant="h5">Submit Your Prompt</Typography>
      <Alert severity="info">
        Submit a strategic prompt that will guide an AI agent to bid on items during the auction.
        Be creative — your prompt determines how aggressively or strategically your agent will bid!
      </Alert>
      <Paper sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Fill out the Google Form below to submit your prompt. You'll receive a confirmation once it's reviewed by an admin.
        </Typography>
        <Box
          sx={{
            width: '100%',
            minHeight: 500,
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography color="text.secondary">
            Google Form will be embedded here. Configure VITE_GOOGLE_FORM_URL in .env
          </Typography>
        </Box>
      </Paper>
    </Stack>
  )
}
