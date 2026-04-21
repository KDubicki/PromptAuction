import { Alert, Stack, Typography } from '@mui/material'

interface Props {
  round: number
  totalRounds: number
  iteration: number
  totalIterations: number
}

export function StatusHeader({ round, totalRounds, iteration, totalIterations }: Props) {
  return (
    <Stack spacing={1}>
      <Typography variant="h5">Live Game Dashboard</Typography>
      <Alert severity="info">Round {round}/{totalRounds}, Iteration {iteration}/{totalIterations}</Alert>
    </Stack>
  )
}
