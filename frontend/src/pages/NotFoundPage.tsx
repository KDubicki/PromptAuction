import { Button, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <Stack spacing={2} alignItems="center" sx={{ py: 8 }}>
      <Typography variant="h2" fontWeight="bold">404</Typography>
      <Typography variant="h6" color="text.secondary">Page not found</Typography>
      <Button component={Link} to="/" variant="contained">
        Back to Home
      </Button>
    </Stack>
  )
}
