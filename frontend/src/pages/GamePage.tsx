import { Grid, Stack, Typography } from '@mui/material'

import { ActionArena } from '../components/ActionArena'
import { BiddingHistoryTable } from '../components/BiddingHistoryTable'
import { LeaderboardInventory } from '../components/LeaderboardInventory'

// Seed data until the dashboard reads live sessions. Kept internally consistent:
// the ladder, the standings and the history all describe the same lots.
const leaderboard = [
  { playerId: 'Aurelia', winRate: 67, items: ['Crystal Fox', 'Nebula Coin'] },
  { playerId: 'Kestrel', winRate: 33, items: ['Echo Blade'] },
  { playerId: 'Morrow', winRate: 0, items: [] },
]

const liveBids = [
  { player: 'Aurelia', bid: 31 },
  { player: 'Kestrel', bid: 29 },
  { player: 'Morrow', bid: 18 },
]

const bids = [
  { player_id: 'Aurelia', item_name: 'Crystal Fox', bid_amount: 31, won: true },
  { player_id: 'Kestrel', item_name: 'Crystal Fox', bid_amount: 29, won: false },
  { player_id: 'Morrow', item_name: 'Crystal Fox', bid_amount: 18, won: false },
  { player_id: 'Kestrel', item_name: 'Echo Blade', bid_amount: 24, won: true },
  { player_id: 'Aurelia', item_name: 'Echo Blade', bid_amount: 22, won: false },
]

export function GamePage() {
  return (
    <Stack spacing={3}>
      <Typography variant="h3" component="h1">
        Live game
      </Typography>

      <ActionArena
        currentItem="Crystal Fox"
        liveBids={liveBids}
        round={2}
        totalRounds={50}
        iteration={15}
        totalIterations={45}
      />

      <Grid container spacing={{ xs: 2, sm: 3 }}>
        <Grid size={{ xs: 12, md: 5 }}>
          <LeaderboardInventory entries={leaderboard} />
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <BiddingHistoryTable bids={bids} />
        </Grid>
      </Grid>
    </Stack>
  )
}
