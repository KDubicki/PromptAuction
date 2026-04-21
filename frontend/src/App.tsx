import { useMemo, useState } from 'react'
import {
  AppBar,
  Box,
  Button,
  Container,
  CssBaseline,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { DarkModeToggle } from './components/DarkModeToggle'
import { StatusHeader } from './components/StatusHeader'
import { ActionArena } from './components/ActionArena'
import { LeaderboardInventory } from './components/LeaderboardInventory'
import { BiddingHistoryTable } from './components/BiddingHistoryTable'
import { AdminPanel } from './components/AdminPanel'
import { LiveGameStateView } from './components/LiveGameStateView'
import { PlayerInventories } from './components/PlayerInventories'

const queryClient = new QueryClient()

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

function Dashboard() {
  const [darkMode, setDarkMode] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? 'dark' : 'light',
        },
      }),
    [darkMode],
  )

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            PromptAuction Dashboard
          </Typography>
          <Button color="inherit" onClick={() => setIsAdmin((value) => !value)}>
            {isAdmin ? 'Disable Admin' : 'Enable Admin'}
          </Button>
          <DarkModeToggle darkMode={darkMode} onToggle={() => setDarkMode((value) => !value)} />
        </Toolbar>
      </AppBar>

      <Container sx={{ py: 4 }} maxWidth="xl">
        <Stack spacing={3}>
          <StatusHeader round={2} totalRounds={50} iteration={15} totalIterations={45} />

          <Paper>
            <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
              <Tab label="Live Dashboard" />
              <Tab label="Admin Panel" />
            </Tabs>
          </Paper>

          {activeTab === 0 && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <LiveGameStateView state="running" item="Crystal Fox" />
              </Grid>
              <Grid size={{ xs: 12, md: 8 }}>
                <ActionArena currentItem="Crystal Fox" liveBids={liveBids} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <LeaderboardInventory entries={leaderboard} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <PlayerInventories players={leaderboard} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <BiddingHistoryTable bids={bids} />
              </Grid>
            </Grid>
          )}

          {activeTab === 1 && <AdminPanel isProtected={isAdmin} />}
        </Stack>
      </Container>
    </ThemeProvider>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Box sx={{ minHeight: '100vh' }}>
        <Dashboard />
      </Box>
    </QueryClientProvider>
  )
}

export default App
