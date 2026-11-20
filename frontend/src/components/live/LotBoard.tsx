import { Box, Stack, Typography } from '@mui/material'

import { Panel } from '../Panel'
import type { Lot } from '../../types'

interface Props {
  lots: Lot[]
  currentNumber: number | null
}

function Result({ lot, current }: { lot: Lot; current: boolean }) {
  if (lot.status === 'sold') {
    return (
      <Stack direction="row" sx={{ gap: 1.5, alignItems: 'baseline', justifyContent: 'flex-end' }}>
        <Typography variant="body2">{lot.sold_to_name}</Typography>
        <Typography variant="caption" data-figure sx={{ color: 'primary.main', fontWeight: 500, minWidth: 40, textAlign: 'right' }}>
          {lot.price}
        </Typography>
      </Stack>
    )
  }
  if (lot.status === 'unsold') {
    return (
      <Typography variant="body2" sx={{ color: 'text.disabled' }}>
        Unsold
      </Typography>
    )
  }
  return (
    <Typography variant="body2" sx={{ color: current ? 'secondary.main' : 'text.disabled', fontWeight: current ? 600 : 400 }}>
      {current ? 'On the block' : 'Upcoming'}
    </Typography>
  )
}

/** Every lot of the session and how it went. */
export function LotBoard({ lots, currentNumber }: Props) {
  const settled = lots.filter((lot) => lot.status !== 'pending').length
  return (
    <Panel title="Lots" slug={`${settled} of ${lots.length} settled`} flush>
      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, maxHeight: 440, overflowY: 'auto' }}>
        {lots.map((lot) => {
          const current = lot.number === currentNumber && lot.status === 'pending'
          return (
            <Box
              component="li"
              key={lot.number}
              aria-current={current ? 'true' : undefined}
              sx={{
                display: 'grid',
                gridTemplateColumns: '28px 1fr auto',
                columnGap: 1.5,
                alignItems: 'baseline',
                px: { xs: 2, sm: 2.5 },
                py: 1.25,
                borderBottom: 1,
                borderColor: 'divider',
                '&:last-of-type': { borderBottom: 0 },
                bgcolor: current ? 'action.hover' : 'transparent',
                opacity: lot.status === 'pending' && !current ? 0.7 : 1,
              }}
            >
              <Typography variant="caption" data-figure sx={{ color: 'text.secondary' }}>
                {lot.number}
              </Typography>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                  {lot.item}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Quality {lot.quality}, {lot.required ? 'required' : 'not required'}
                </Typography>
              </Box>
              <Result lot={lot} current={current} />
            </Box>
          )
        })}
      </Box>
    </Panel>
  )
}
