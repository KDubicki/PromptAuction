import { useState, useMemo } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  AppBar,
  Box,
  Container,
  CssBaseline,
  Tab,
  Tabs,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from '@mui/material'

import { DarkModeToggle } from '../components/DarkModeToggle'

const NAV_ITEMS = [
  { label: 'Live Game', path: '/' },
  { label: 'Admin', path: '/admin' },
  { label: 'Leaderboard', path: '/leaderboard' },
  { label: 'Submit Prompt', path: '/submit' },
]

export function RootLayout() {
  const [darkMode, setDarkMode] = useState(true)
  const location = useLocation()

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? 'dark' : 'light',
        },
      }),
    [darkMode],
  )

  const currentTab = NAV_ITEMS.findIndex(
    (item) => item.path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.path),
  )

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static">
          <Toolbar>
            <Typography
              variant="h6"
              component={Link}
              to="/"
              sx={{ flexGrow: 1, textDecoration: 'none', color: 'inherit' }}
            >
              PromptAuction
            </Typography>
            <DarkModeToggle darkMode={darkMode} onToggle={() => setDarkMode((v) => !v)} />
          </Toolbar>
          <Tabs
            value={currentTab === -1 ? false : currentTab}
            textColor="inherit"
            indicatorColor="secondary"
            variant="scrollable"
            scrollButtons="auto"
          >
            {NAV_ITEMS.map((item) => (
              <Tab
                key={item.path}
                label={item.label}
                component={Link}
                to={item.path}
              />
            ))}
          </Tabs>
        </AppBar>

        <Container sx={{ py: 3, flex: 1 }} maxWidth="xl">
          <Outlet />
        </Container>
      </Box>
    </ThemeProvider>
  )
}
