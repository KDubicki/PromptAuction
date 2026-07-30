import { Box, Stack, Typography } from '@mui/material'

interface Props {
  live: boolean
}

/**
 * The engine's heartbeat. One of only two places in the app that animates,
 * and it stops under `prefers-reduced-motion`.
 */
export function LiveIndicator({ live }: Props) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
      <Box
        aria-hidden
        sx={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          bgcolor: live ? 'secondary.main' : 'text.disabled',
          animation: live ? 'pulse 2s ease-in-out infinite' : 'none',
          '@keyframes pulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.35 },
          },
        }}
      />
      <Typography variant="overline" sx={{ color: live ? 'text.primary' : 'text.disabled' }}>
        {live ? 'Live' : 'Idle'}
      </Typography>
    </Stack>
  )
}
