import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, Stack } from '@mui/material'

const mockLeaderboard = [
  { rank: 1, player: 'p1', wins: 12, winRate: 67, elo: 1450 },
  { rank: 2, player: 'p2', wins: 8, winRate: 50, elo: 1320 },
  { rank: 3, player: 'p3', wins: 5, winRate: 33, elo: 1180 },
]

export function LeaderboardPage() {
  return (
    <Stack spacing={3}>
      <Typography variant="h5">Leaderboard</Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Rank</TableCell>
              <TableCell>Player</TableCell>
              <TableCell align="right">Wins</TableCell>
              <TableCell align="right">Win Rate</TableCell>
              <TableCell align="right">ELO</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mockLeaderboard.map((row) => (
              <TableRow key={row.rank}>
                <TableCell>#{row.rank}</TableCell>
                <TableCell>{row.player}</TableCell>
                <TableCell align="right">{row.wins}</TableCell>
                <TableCell align="right">{row.winRate}%</TableCell>
                <TableCell align="right">{row.elo}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  )
}
