import { Stack, Typography } from '@mui/material'

import { LiveIndicator } from './LiveIndicator'
import { Panel } from './Panel'

interface Props {
  state: string
  item: string
}

export function LiveGameStateView({ state, item }: Props) {
  return (
    <Panel title="Engine" action={<LiveIndicator live={state === 'running'} />}>
      <Stack spacing={2.5}>
        <Stack spacing={0.25}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            State
          </Typography>
          <Typography sx={{ textTransform: 'capitalize' }}>{state}</Typography>
        </Stack>

        <Stack spacing={0.25}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            Current item
          </Typography>
          <Typography sx={{ overflowWrap: 'anywhere' }}>{item}</Typography>
        </Stack>
      </Stack>
    </Panel>
  )
}
