import { useMemo, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import MenuIcon from '@mui/icons-material/Menu'
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  ThemeProvider,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material'

import { DarkModeToggle } from '../components/DarkModeToggle'
import { LiveIndicator } from '../components/LiveIndicator'
import { buildTheme } from '../theme'
import { useColorMode } from '../theme/useColorMode'

const NAV_ITEMS = [
  { label: 'Live game', path: '/' },
  { label: 'Admin', path: '/admin' },
  { label: 'Leaderboard', path: '/leaderboard' },
  { label: 'Submit prompt', path: '/submit' },
]

const DRAWER_WIDTH = 240

function isActive(pathname: string, path: string) {
  return path === '/' ? pathname === '/' : pathname.startsWith(path)
}

export function RootLayout() {
  const { mode, toggle } = useColorMode()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  const theme = useMemo(() => buildTheme(mode), [mode])
  const permanent = useMediaQuery(theme.breakpoints.up('lg'))

  const nav = (
    <List sx={{ px: 1.5, py: 2 }}>
      {NAV_ITEMS.map((item) => {
        const active = isActive(location.pathname, item.path)
        return (
          <ListItemButton
            key={item.path}
            component={Link}
            to={item.path}
            selected={active}
            onClick={() => setMobileOpen(false)}
            sx={{
              borderRadius: 1,
              mb: 0.5,
              minHeight: 44,
              // The active rail is the only brass in the navigation; the fill
              // stays neutral so the sidebar never warms toward the accent.
              borderLeft: 2,
              borderColor: active ? 'primary.main' : 'transparent',
              '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'action.hover' },
            }}
          >
            <ListItemText
              primary={item.label}
              slotProps={{
                primary: {
                  sx: {
                    fontSize: '0.9375rem',
                    fontWeight: active ? 600 : 400,
                    color: active ? 'text.primary' : 'text.secondary',
                  },
                },
              }}
            />
          </ListItemButton>
        )
      })}
    </List>
  )

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        component="a"
        href="#main"
        sx={{
          position: 'absolute',
          left: -9999,
          zIndex: 2000,
          p: 2,
          bgcolor: 'background.paper',
          '&:focus': { left: 8, top: 8 },
        }}
      >
        Skip to content
      </Box>

      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            bgcolor: 'background.paper',
            color: 'text.primary',
            borderBottom: 1,
            borderColor: 'divider',
            zIndex: (t) => t.zIndex.drawer + 1,
          }}
        >
          <Toolbar sx={{ gap: 1.5 }}>
            {!permanent && (
              <IconButton
                edge="start"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
                color="inherit"
              >
                <MenuIcon />
              </IconButton>
            )}

            <Typography
              variant="h6"
              component={Link}
              to="/"
              sx={{ textDecoration: 'none', color: 'inherit', letterSpacing: '-0.01em' }}
            >
              PromptAuction
            </Typography>

            <Box sx={{ flexGrow: 1 }} />

            <Stack direction="row" sx={{ alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
              <LiveIndicator live />
              <Typography
                variant="overline"
                data-figure
                sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}
              >
                R2 / 50
              </Typography>
              <DarkModeToggle darkMode={mode === 'dark'} onToggle={toggle} />
            </Stack>
          </Toolbar>
        </AppBar>

        <Box component="nav" sx={{ width: { lg: DRAWER_WIDTH }, flexShrink: { lg: 0 } }}>
          <Drawer
            variant={permanent ? 'permanent' : 'temporary'}
            open={permanent || mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': {
                width: DRAWER_WIDTH,
                boxSizing: 'border-box',
                borderRight: 1,
                borderColor: 'divider',
              },
            }}
          >
            <Toolbar />
            <Divider />
            {nav}
          </Drawer>
        </Box>

        <Box
          component="main"
          id="main"
          sx={{
            flex: 1,
            minWidth: 0,
            px: { xs: 2, sm: 3, lg: 4 },
            py: { xs: 3, sm: 4 },
            mt: { xs: 7, sm: 8 },
          }}
        >
          <Box sx={{ maxWidth: 1600, mx: 'auto' }}>
            <Outlet />
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  )
}
