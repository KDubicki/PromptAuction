import { playerKey } from './liveGame'
import type { GameSession, Lot, RosterEntry, SessionBid } from './types'

export function bidsOfLot(bids: SessionBid[], lotNumber: number): SessionBid[] {
  return bids.filter((b) => b.lot_number === lotNumber)
}

export function roundsPlayed(lotBids: SessionBid[]): number {
  return lotBids.reduce((max, b) => Math.max(max, b.round), 0)
}

export interface RoundState {
  round: number
  price: number
  leader: string | null
  leaderRef: string | null
  /** Whether the price moved in this round. */
  raised: boolean
}

/** The price and the leader after each round of one lot. */
export function roundStates(lotBids: SessionBid[]): RoundState[] {
  const states: RoundState[] = []
  let price = 0
  let leader: string | null = null
  let leaderRef: string | null = null
  for (let round = 1; round <= roundsPlayed(lotBids); round++) {
    const lead = lotBids.find((b) => b.round === round && (b.outcome === 'leading' || b.won))
    if (lead) {
      price = lead.bid ?? price
      leader = lead.player_id
      leaderRef = playerKey(lead)
    }
    states.push({ round, price, leader, leaderRef, raised: Boolean(lead) })
  }
  return states
}

/** Each agent's latest call on the lot, up to and including a round. */
export function callsUpTo(lotBids: SessionBid[], round: number): Map<string, SessionBid> {
  const latest = new Map<string, SessionBid>()
  for (const bid of lotBids) {
    if (bid.round > round) continue
    const key = playerKey(bid)
    const seen = latest.get(key)
    if (!seen || bid.round >= seen.round) latest.set(key, bid)
  }
  return latest
}

/** The roster as it stood when a lot went under the hammer: budgets and items before it. */
export function rosterBefore(session: GameSession, lotNumber: number): RosterEntry[] {
  return session.roster.map((entry) => {
    const items = entry.items.filter((item) => item.lot_number < lotNumber)
    const spent = items.reduce((sum, item) => sum + item.price, 0)
    return { ...entry, items, budget: session.settings.budget - spent }
  })
}

export function belongsTo(bid: SessionBid, entry: Pick<RosterEntry, 'player_ref' | 'name'>): boolean {
  return bid.player_ref ? bid.player_ref === entry.player_ref : bid.player_id === entry.name
}

export type DiaryResult = 'bought' | 'outbid' | 'stayed_out' | 'in_play'

export interface DiaryEntry {
  lot: Lot
  calls: SessionBid[]
  result: DiaryResult
  topBid: number
}

const VALID = new Set(['leading', 'outbid'])

/** One agent's game, lot by lot: every call it made and how each lot ended for it. */
export function agentDiary(session: GameSession, bids: SessionBid[], entry: RosterEntry): DiaryEntry[] {
  return session.lots
    .map((lot) => {
      const calls = bids
        .filter((b) => b.lot_number === lot.number && belongsTo(b, entry))
        .sort((a, b) => a.round - b.round)
      const valid = calls.filter((c) => VALID.has(c.outcome ?? '') || c.won)
      const topBid = valid.reduce((max, c) => Math.max(max, c.bid ?? 0), 0)
      let result: DiaryResult
      if (lot.status === 'pending') result = 'in_play'
      else if (lot.sold_to === entry.player_ref) result = 'bought'
      else if (valid.length > 0) result = 'outbid'
      else result = 'stayed_out'
      return { lot, calls, result, topBid }
    })
    .filter((e) => e.lot.status !== 'pending' || e.calls.length > 0)
}

export interface DiarySummary {
  bought: number
  spent: number
  valid: number
  passes: number
  rejected: number
  silent: number
  avgSeconds: number | null
}

export function summarizeDiary(entries: DiaryEntry[]): DiarySummary {
  const calls = entries.flatMap((e) => e.calls)
  const timed = calls.filter((c) => c.response_ms !== null && c.outcome !== 'no_answer')
  const bought = entries.filter((e) => e.result === 'bought')
  return {
    bought: bought.length,
    spent: bought.reduce((sum, e) => sum + (e.lot.price ?? 0), 0),
    valid: calls.filter((c) => VALID.has(c.outcome ?? '') || c.won).length,
    passes: calls.filter((c) => c.outcome === 'pass').length,
    rejected: calls.filter((c) => c.outcome === 'not_higher' || c.outcome === 'over_budget').length,
    silent: calls.filter((c) => c.outcome === 'no_answer').length,
    avgSeconds: timed.length ? timed.reduce((s, c) => s + (c.response_ms ?? 0), 0) / timed.length / 1000 : null,
  }
}

export function initials(name: string): string {
  const parts = name.split(/[\s_-]+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)
  return letters.toUpperCase()
}
