import { Typography } from '@mui/material'

import { DataTable, type Column } from './DataTable'
import { Panel } from './Panel'
import type { PlayerBid } from '../types'

interface Props {
  bids: PlayerBid[]
}

const columns: Column<PlayerBid>[] = [
  { key: 'player', header: 'Agent', render: (bid) => bid.player_id },
  { key: 'item', header: 'Lot', render: (bid) => bid.item_name },
  {
    key: 'bid',
    header: 'Bid',
    align: 'right',
    figure: true,
    render: (bid) => bid.bid_amount,
  },
  {
    key: 'won',
    header: 'Outcome',
    align: 'right',
    render: (bid) => (
      <Typography
        component="span"
        variant="caption"
        sx={{ color: bid.won ? 'primary.main' : 'text.disabled', fontWeight: bid.won ? 500 : 400 }}
      >
        {bid.won ? 'Won' : 'Outbid'}
      </Typography>
    ),
  },
]

export function BiddingHistoryTable({ bids }: Props) {
  return (
    <Panel title="Bidding history" slug={`${bids.length} bids`} flush>
      <DataTable
        columns={columns}
        rows={bids}
        rowKey={(bid, index) => `${bid.player_id}-${index}`}
        emptyMessage="No bids recorded yet."
      />
    </Panel>
  )
}
