import { Box, Card, Stack, Typography } from '@mui/material'

import { Figure } from './Figure'

interface Props {
  round: number
  totalRounds: number
  iteration: number
  totalIterations: number
}

export function StatusHeader({ round, totalRounds, iteration, totalIterations }: Props) {
  const progress = totalIterations > 0 ? (iteration / totalIterations) * 100 : 0

  return (
    <Stack spacing={2}>
      <Typography variant="h3" component="h1">
        Live game
      </Typography>

      <Card>
        {/* A plain flex Box rather than Stack — wrapping has to be reliable at 320px. */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            columnGap: { xs: 3, sm: 4 },
            rowGap: 2,
            px: { xs: 2, sm: 2.5 },
            py: 2,
          }}
        >
          <Figure label="Round" value={round} suffix={`/ ${totalRounds}`} />
          <Figure label="Iteration" value={iteration} suffix={`/ ${totalIterations}`} />
          <Figure label="Lot" value="Crystal Fox" />
          <Figure label="Hammer" value={31} emphasis />
        </Box>

        {/* Progress through the current round. */}
        <Box
          role="progressbar"
          aria-label="Round progress"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          sx={{ height: 2, bgcolor: 'divider' }}
        >
          <Box sx={{ width: `${progress}%`, height: '100%', bgcolor: 'primary.main' }} />
        </Box>
      </Card>
    </Stack>
  )
}
