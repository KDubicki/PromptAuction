import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { Alert, Box, Button, Card, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material'

import { useGameSessions, useSessionBids } from '../api/hooks'
import { AgentSeats } from '../components/live/AgentSeats'
import { LotBoard } from '../components/live/LotBoard'
import { RoomTranscript } from '../components/live/RoomTranscript'
import { Rostrum } from '../components/live/Rostrum'
import { WinnerStage } from '../components/live/WinnerStage'
import { SessionStandings } from '../components/SessionStandings'
import { currentLot, latestCalls, pickSession, watchableSessions } from '../liveGame'
import type { GameStatus } from '../types'

const STATUS_LABEL: Record<GameStatus, string> = {
  running: 'Live',
  paused: 'Paused',
  completed: 'Finished',
  pending: 'Not started',
}

function EmptyRoom() {
  return (
    <Card sx={{ px: { xs: 2, sm: 4 }, py: { xs: 4, sm: 6 } }}>
      <Stack spacing={2} sx={{ alignItems: 'flex-start', maxWidth: 560 }}>
        <Typography variant="h4" component="h2">
          No auction to watch yet
        </Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Start a session in Admin. As soon as it runs, the lot on the block, every agent's call and the standings
          show up here.
        </Typography>
        <Button component={RouterLink} to="/admin" variant="contained">
          Open Admin
        </Button>
      </Stack>
    </Card>
  )
}

export function GamePage() {
  const [params, setParams] = useSearchParams()
  const { data: sessions = [] } = useGameSessions()
  const watchable = watchableSessions(sessions)
  const session = pickSession(sessions, params.get('session'))
  const lot = session ? currentLot(session) : null
  const { data: bids = [] } = useSessionBids(session?.id ?? null, lot?.number, session?.status === 'running')
  const calls = latestCalls(bids)

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-end' }, gap: 2 }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h3" component="h1">
            Live game
          </Typography>
          {session && (
            <Typography sx={{ color: 'text.secondary' }}>
              {session.name},{' '}
              <Box
                component="span"
                sx={{ color: session.status === 'running' ? 'secondary.main' : 'text.secondary', fontWeight: 600 }}
              >
                {STATUS_LABEL[session.status].toLowerCase()}
              </Box>
            </Typography>
          )}
        </Stack>
        {watchable.length > 1 && session && (
          <TextField
            select
            size="small"
            label="Session"
            value={session.id}
            onChange={(e) => setParams({ session: e.target.value })}
            sx={{ minWidth: 240 }}
          >
            {watchable.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name} ({STATUS_LABEL[s.status].toLowerCase()})
              </MenuItem>
            ))}
          </TextField>
        )}
      </Stack>

      {!session || !lot ? (
        <EmptyRoom />
      ) : (
        <>
          {session.status === 'paused' && (
            <Alert severity="warning">
              {session.pause_reason ?? 'The admin paused this auction.'} Resume it in Admin to continue.
            </Alert>
          )}

          {session.status === 'completed' ? (
            <WinnerStage session={session} />
          ) : (
            <Rostrum session={session} lot={lot} />
          )}

          <AgentSeats session={session} calls={calls} />

          <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ alignItems: 'flex-start' }}>
            <Grid size={{ xs: 12, md: 7 }}>
              <RoomTranscript lotNumber={lot.number} bids={bids} maxRounds={session.settings.max_rounds} />
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Stack spacing={{ xs: 2, sm: 3 }}>
                <SessionStandings session={session} />
                <LotBoard lots={session.lots} currentNumber={session.auction?.lot_number ?? null} />
              </Stack>
            </Grid>
          </Grid>
        </>
      )}
    </Stack>
  )
}
