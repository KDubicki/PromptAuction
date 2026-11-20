import type { GameSession, GameStatus, Lot, SessionBid } from './types'

const WATCH_ORDER: Record<GameStatus, number> = { running: 0, paused: 1, completed: 2, pending: 3 }

/** Sessions that have an auction to show: started at least once, with lots. */
export function watchableSessions(sessions: GameSession[]): GameSession[] {
  return sessions
    .filter((s) => s.lots.length > 0)
    .sort((a, b) => {
      const byStatus = WATCH_ORDER[a.status] - WATCH_ORDER[b.status]
      if (byStatus !== 0) return byStatus
      return (b.started_at ?? '').localeCompare(a.started_at ?? '')
    })
}

/** The session the page shows: the one asked for, else a running one, else the latest. */
export function pickSession(sessions: GameSession[], preferredId: string | null): GameSession | null {
  const watchable = watchableSessions(sessions)
  return watchable.find((s) => s.id === preferredId) ?? watchable[0] ?? null
}

/** The lot on the block, or the last lot once the auction is over. */
export function currentLot(session: GameSession): Lot | null {
  const number = session.auction?.lot_number ?? session.lots.length
  return session.lots.find((lot) => lot.number === number) ?? null
}

export interface RoundCalls {
  round: number
  calls: SessionBid[]
}

/** Newest round first; within a round, calls in the order the answers arrived. */
export function groupRounds(bids: SessionBid[]): RoundCalls[] {
  const byRound = new Map<number, SessionBid[]>()
  for (const bid of bids) {
    const calls = byRound.get(bid.round) ?? []
    calls.push(bid)
    byRound.set(bid.round, calls)
  }
  return [...byRound.entries()]
    .sort(([a], [b]) => b - a)
    .map(([round, calls]) => ({
      round,
      calls: [...calls].sort((a, b) => (a.response_ms ?? Infinity) - (b.response_ms ?? Infinity)),
    }))
}

export function playerKey(bid: Pick<SessionBid, 'player_ref' | 'player_id'>): string {
  return bid.player_ref ?? bid.player_id
}

/** Each agent's most recent call on the lot. */
export function latestCalls(bids: SessionBid[]): Map<string, SessionBid> {
  const latest = new Map<string, SessionBid>()
  for (const bid of bids) {
    const key = playerKey(bid)
    const seen = latest.get(key)
    if (!seen || bid.round >= seen.round) latest.set(key, bid)
  }
  return latest
}

export type CallTone = 'won' | 'lead' | 'plain' | 'muted' | 'rejected'

export const TONE_COLOR: Record<CallTone, string> = {
  won: 'primary.main',
  lead: 'primary.main',
  plain: 'text.primary',
  muted: 'text.secondary',
  rejected: 'error.main',
}

export interface CallSummary {
  text: string
  tag: string | null
  tone: CallTone
}

/** What an agent did in one round, in the room's words. */
export function describeCall(bid: SessionBid): CallSummary {
  const amount = `Bids ${bid.bid ?? 0}`
  if (bid.won) return { text: amount, tag: 'Wins the lot', tone: 'won' }
  switch (bid.outcome) {
    case 'leading':
      return { text: amount, tag: 'Takes the lead', tone: 'lead' }
    case 'outbid':
      return { text: amount, tag: 'Outbid', tone: 'plain' }
    case 'pass':
      return { text: 'Passes', tag: null, tone: 'muted' }
    case 'not_higher':
      return { text: amount, tag: 'Too low', tone: 'rejected' }
    case 'over_budget':
      return { text: amount, tag: 'Over budget', tone: 'rejected' }
    default:
      return { text: 'No answer', tag: null, tone: 'muted' }
  }
}

export function formatSeconds(ms: number | null): string | null {
  return ms === null ? null : `${(ms / 1000).toFixed(1)} s`
}
