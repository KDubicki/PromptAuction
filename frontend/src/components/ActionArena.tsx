import { Stack, Typography } from '@mui/material'

import { BidLadder } from './BidLadder'
import { Panel } from './Panel'

interface Props {
  currentItem: string
  liveBids: Array<{ player: string; bid: number }>
  /** Sealed bids stay at the floor until the iteration resolves. */
  revealed?: boolean
  lotIndex?: number
  lotTotal?: number
}

export function ActionArena({
  currentItem,
  liveBids,
  revealed = true,
  lotIndex = 4,
  lotTotal = 45,
}: Props) {
  const slug = `Lot ${String(lotIndex).padStart(2, '0')} / ${lotTotal}`

  return (
    <Panel title="Action arena" slug={slug}>
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            On the block
          </Typography>
          <Typography variant="h2" component="p" sx={{ overflowWrap: 'anywhere' }}>
            {currentItem}
          </Typography>
        </Stack>

        <BidLadder
          bids={liveBids.map((entry) => ({ player: entry.player, amount: entry.bid }))}
          revealed={revealed}
        />
      </Stack>
    </Panel>
  )
}
