import { Grid, Stack } from '@mui/material'

import { StatusHeader } from '../components/StatusHeader'
import { ActionArena } from '../components/ActionArena'
import { LeaderboardInventory } from '../components/LeaderboardInventory'
import { BiddingHistoryTable } from '../components/BiddingHistoryTable'
import { LiveGameStateView } from '../components/LiveGameStateView'
import { PlayerInventories } from '../components/PlayerInventories'

const leaderboard = [
  { playerId: 'p1', winRate: 67, items: ['Crystal Fox', 'Nebula Coin'] },
  { playerId: 'p2', winRate: 50, items: ['Echo Blade'] },
]

const bids = [
  { player_id: 'p1', item_name: 'Crystal Fox', bid_amount: 28, won: true },
  { player_id: 'p2', item_name: 'Crystal Fox', bid_amount: 19, won: false },
]

const liveBids = [
  { player: 'p1', bid: 31 },
  { player: 'p2', bid: 29 },
]

export function GamePage() {
  return (
    <Stack spacing={3}>
      <StatusHeader round={2} totalRounds={50} iteration={15} totalIterations={45} />

      <Grid container spacing={{ xs: 2, sm: 3 }}>
        {/* The arena leads — everything else is context for it. */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <ActionArena currentItem="Crystal Fox" liveBids={liveBids} />
        </Grid>
        {/* Sized to its content — a short panel stretched to the arena's height reads as broken. */}
        <Grid size={{ xs: 12, lg: 4 }} sx={{ alignSelf: 'start' }}>
          <LiveGameStateView state="running" item="Crystal Fox" />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <LeaderboardInventory entries={leaderboard} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <PlayerInventories players={leaderboard} />
        </Grid>

        <Grid size={12}>
          <BiddingHistoryTable bids={bids} />
        </Grid>
      </Grid>
    </Stack>
  )
}
