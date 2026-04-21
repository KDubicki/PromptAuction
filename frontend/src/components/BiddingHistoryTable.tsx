import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'

import type { PlayerBid } from '../types'

interface Props {
  bids: PlayerBid[]
}

export function BiddingHistoryTable({ bids }: Props) {
  return (
    <TableContainer component={Paper}>
      <Typography variant="h6" sx={{ p: 2 }}>
        Bidding History
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Player</TableCell>
            <TableCell>Item</TableCell>
            <TableCell>Bid</TableCell>
            <TableCell>Won</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {bids.map((bid, idx) => (
            <TableRow key={`${bid.player_id}-${idx}`}>
              <TableCell>{bid.player_id}</TableCell>
              <TableCell>{bid.item_name}</TableCell>
              <TableCell>{bid.bid_amount}</TableCell>
              <TableCell>{bid.won ? 'Yes' : 'No'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
