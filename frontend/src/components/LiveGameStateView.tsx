import { Card, CardContent, Stack, Typography } from '@mui/material'

interface Props {
  state: string
  item: string
}

export function LiveGameStateView({ state, item }: Props) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="h6">Live Game State</Typography>
          <Typography>State: {state}</Typography>
          <Typography>Current Item: {item}</Typography>
        </Stack>
      </CardContent>
    </Card>
  )
}
