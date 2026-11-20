import { useEffect, useRef, useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { Alert, Box, Button, Card, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material'

import { useGameSessions, useSessionBids } from '../api/hooks'
import { AgentDiary } from '../components/live/AgentDiary'
import { AgentSeats } from '../components/live/AgentSeats'
import { LotBoard } from '../components/live/LotBoard'
import { LotStrip } from '../components/live/LotStrip'
import { ReplayStage } from '../components/live/ReplayStage'
import { RoomTranscript } from '../components/live/RoomTranscript'
import { Rostrum } from '../components/live/Rostrum'
import { WinnerStage } from '../components/live/WinnerStage'
import { SessionStandings } from '../components/SessionStandings'
import { latestCalls, pickSession, watchableSessions } from '../liveGame'
import { agentDiary, bidsOfLot, callsUpTo, rosterBefore, roundStates } from '../replay'
import type { GameSession, GameStatus, SessionBid } from '../types'

const STATUS_LABEL: Record<GameStatus, string> = {
  running: 'Live',
  paused: 'Paused',
  completed: 'Finished',
  pending: 'Not started',
}

/** How long each replayed round stays on screen, and how long a closed lot holds before the next. */
const ROUND_MS = 1300
const LOT_HOLD_MS = 2400

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

interface ArenaProps {
  session: GameSession
  bids: SessionBid[]
  lotParam: string | null
  agentParam: string | null
  setParam: (key: 'lot' | 'agent', value: string | null) => void
}

function Arena({ session, bids, lotParam, agentParam, setParam }: ArenaProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const liveNumber = session.status !== 'completed' ? (session.auction?.lot_number ?? null) : null
  const reachable = (n: number) =>
    session.lots.some((lot) => lot.number === n && (lot.status !== 'pending' || n === liveNumber))

  const requested = Number(lotParam)
  const viewNumber = reachable(requested) ? requested : (liveNumber ?? 1)
  const lot = session.lots.find((l) => l.number === viewNumber) ?? session.lots[0]
  const isLiveView = liveNumber !== null && viewNumber === liveNumber

  const lotBids = bidsOfLot(bids, viewNumber)
  const states = roundStates(lotBids)
  const key = `${session.id}:${viewNumber}`
  const [scrub, setScrub] = useState<{ key: string; round: number } | null>(null)
  const [playing, setPlaying] = useState(false)
  const round = scrub?.key === key ? Math.min(scrub.round, states.length) : states.length

  const followed = session.roster.find((entry) => entry.player_ref === agentParam) ?? null

  const nextClosedLot = (n: number) =>
    session.lots.find((l) => l.number > n && l.status !== 'pending' && l.number !== liveNumber)?.number ?? null

  useEffect(() => {
    if (!playing || isLiveView) return
    const atEnd = round >= states.length
    const timer = setTimeout(
      () => {
        if (!atEnd) {
          setScrub({ key, round: round + 1 })
          return
        }
        const next = nextClosedLot(viewNumber)
        if (next === null) {
          setPlaying(false)
          return
        }
        setScrub({ key: `${session.id}:${next}`, round: 1 })
        setParam('lot', String(next))
      },
      atEnd ? LOT_HOLD_MS : ROUND_MS,
    )
    return () => clearTimeout(timer)
  })

  const selectLot = (n: number) => {
    setPlaying(false)
    setParam('lot', String(n))
  }

  const watchLot = (n: number) => {
    selectLot(n)
    stageRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  const togglePlay = () => {
    if (playing) {
      setPlaying(false)
      return
    }
    if (round >= states.length) setScrub({ key, round: 1 })
    setPlaying(true)
  }

  const replayLeader = states[round - 1]?.leaderRef ?? null
  const seats = isLiveView
    ? { roster: session.roster, calls: latestCalls(lotBids), leaderRef: session.auction?.leader_ref ?? null }
    : { roster: rosterBefore(session, viewNumber), calls: callsUpTo(lotBids, round), leaderRef: replayLeader }
  const transcriptBids = isLiveView ? lotBids : lotBids.filter((b) => b.round <= round)

  return (
    <>
      <Card sx={{ px: { xs: 2, sm: 2.5 }, pt: 2, pb: 1 }}>
        <LotStrip
          lots={session.lots}
          selected={viewNumber}
          liveNumber={liveNumber}
          followedRef={followed?.player_ref ?? null}
          onSelect={selectLot}
          onLive={liveNumber !== null ? () => selectLot(liveNumber) : undefined}
        />
      </Card>

      <Box ref={stageRef} sx={{ scrollMarginTop: 80 }}>
        {isLiveView ? (
          <Rostrum session={session} lot={lot} />
        ) : (
          <ReplayStage
            lot={lot}
            lotsCount={session.lots.length}
            states={states}
            round={round}
            playing={playing}
            onRound={(r) => {
              setPlaying(false)
              setScrub({ key, round: r })
            }}
            onTogglePlay={togglePlay}
          />
        )}
      </Box>

      <Stack spacing={1.5}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {isLiveView
            ? 'Agents now. Follow one to see everything it answered.'
            : `Agents as they stood when lot ${viewNumber} came up. Follow one to see everything it answered.`}
        </Typography>
        <AgentSeats
          roster={seats.roster}
          startBudget={session.settings.budget}
          calls={seats.calls}
          leaderRef={seats.leaderRef}
          followedRef={followed?.player_ref ?? null}
          waiting={isLiveView && session.status === 'running'}
          onFollow={(ref) => setParam('agent', ref === followed?.player_ref ? null : ref)}
        />
      </Stack>

      {followed && (
        <AgentDiary
          name={followed.name}
          entries={agentDiary(session, bids, followed)}
          selectedLot={viewNumber}
          onWatch={watchLot}
        />
      )}

      <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ alignItems: 'flex-start' }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <RoomTranscript
            lotNumber={viewNumber}
            bids={transcriptBids}
            maxRounds={session.settings.max_rounds}
            followedKey={followed?.player_ref ?? null}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={{ xs: 2, sm: 3 }}>
            <SessionStandings session={session} />
            <LotBoard lots={session.lots} currentNumber={liveNumber} selectedNumber={viewNumber} onSelect={selectLot} />
          </Stack>
        </Grid>
      </Grid>
    </>
  )
}

export function GamePage() {
  const [params, setParams] = useSearchParams()
  const { data: sessions = [] } = useGameSessions()
  const watchable = watchableSessions(sessions)
  const session = pickSession(sessions, params.get('session'))
  const { data: bids = [] } = useSessionBids(session?.id ?? null, undefined, session?.status === 'running')

  const setParam = (key: 'lot' | 'agent', value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (session) next.set('session', session.id)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )

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

      {!session ? (
        <EmptyRoom />
      ) : (
        <>
          {session.status === 'paused' && (
            <Alert severity="warning">
              {session.pause_reason ?? 'The admin paused this auction.'} Resume it in Admin to continue.
            </Alert>
          )}
          {session.status === 'completed' && <WinnerStage session={session} />}
          <Arena
            key={session.id}
            session={session}
            bids={bids}
            lotParam={params.get('lot')}
            agentParam={params.get('agent')}
            setParam={setParam}
          />
        </>
      )}
    </Stack>
  )
}
