import { Button, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <Stack spacing={2.5} sx={{ alignItems: 'flex-start', maxWidth: '48ch', py: { xs: 6, sm: 10 } }}>
      <Typography variant="overline" data-figure sx={{ color: 'text.disabled' }}>
        404
      </Typography>
      <Typography variant="h2" component="h1">
        No lot at this address
      </Typography>
      <Typography sx={{ color: 'text.secondary' }}>
        The page you asked for is not part of this auction. Head back to the floor to see what is
        on the block.
      </Typography>
      <Button component={Link} to="/" variant="contained">
        Back to the live game
      </Button>
    </Stack>
  )
}
