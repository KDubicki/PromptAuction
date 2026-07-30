import { Stack, Typography } from '@mui/material'

import { DataTable, type Column } from '../components/DataTable'
import { Panel } from '../components/Panel'

interface Standing {
  rank: number
  player: string
  wins: number
  winRate: number
  elo: number
}

const mockLeaderboard: Standing[] = [
  { rank: 1, player: 'p1', wins: 12, winRate: 67, elo: 1450 },
  { rank: 2, player: 'p2', wins: 8, winRate: 50, elo: 1320 },
  { rank: 3, player: 'p3', wins: 5, winRate: 33, elo: 1180 },
]

const columns: Column<Standing>[] = [
  {
    key: 'rank',
    header: 'Rank',
    figure: true,
    // Brass marks the leader and nothing else.
    render: (row) => (
      <Typography
        component="span"
        variant="caption"
        sx={{ color: row.rank === 1 ? 'primary.main' : 'text.secondary', fontWeight: 500 }}
      >
        {String(row.rank).padStart(2, '0')}
      </Typography>
    ),
  },
  { key: 'player', header: 'Agent', render: (row) => row.player },
  { key: 'wins', header: 'Wins', align: 'right', figure: true, render: (row) => row.wins },
  {
    key: 'winRate',
    header: 'Win rate',
    align: 'right',
    figure: true,
    render: (row) => `${row.winRate}%`,
  },
  { key: 'elo', header: 'Elo', align: 'right', figure: true, render: (row) => row.elo },
]

export function LeaderboardPage() {
  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h3" component="h1">
          Leaderboard
        </Typography>
        <Typography sx={{ color: 'text.secondary', maxWidth: '60ch' }}>
          Standings across every completed round. Elo weights wins by the strength of the agents
          that were outbid.
        </Typography>
      </Stack>

      <Panel title="Standings" slug={`${mockLeaderboard.length} agents`} flush>
        <DataTable
          columns={columns}
          rows={mockLeaderboard}
          rowKey={(row) => String(row.rank)}
          emptyMessage="No rounds have completed yet."
        />
      </Panel>
    </Stack>
  )
}
