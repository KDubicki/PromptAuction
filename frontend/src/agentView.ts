import { playerKey } from './liveGame'
import { belongsTo, bidsOfLot, rosterBefore, roundStates } from './replay'
import type { GameSession, RosterEntry, SessionBid } from './types'

/** Must mirror `build_state` in backend/app/services/auction/prompt.py. */
export interface AgentState {
  lot: { number: number; of: number; item: string; quality: number; required: boolean }
  auction: { current_round: number; max_rounds: number; highest_bid: number; leader: string | null }
  you: string
  required_items: string[]
  players: Array<{ name: string; budget: number; items: Array<{ item: string; quality: number; required: boolean }> }>
  remaining_lots: number
}

export interface AgentView {
  entry: RosterEntry
  state: AgentState
  /** The user message exactly as the engine builds it (`build_user_message`). */
  message: string
  /** The agent's own budget and items at that moment. */
  me: AgentState['players'][number]
  /** Its best copy of the item on the block, if it already had one. */
  ownedCopy: { item: string; quality: number } | null
  explanation: string
}

export function buildUserMessage(instructions: string, state: AgentState): string {
  return `Your player's instructions:\n<<<\n${instructions}\n>>>\n\nGame state:\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\``
}

/**
 * Rebuilds what the agent was shown for one call. Everything in the state is
 * on the session record: the lot, the price and leader after the previous
 * round, and budgets and items as they stood when the lot came up.
 */
export function buildState(session: GameSession, bids: SessionBid[], call: SessionBid, entry: RosterEntry): AgentState | null {
  const lot = session.lots.find((l) => l.number === call.lot_number)
  if (!lot) return null
  const before = roundStates(bidsOfLot(bids, lot.number))[call.round - 2]
  return {
    lot: { number: lot.number, of: session.settings.lots_count, item: lot.item, quality: lot.quality, required: lot.required },
    auction: {
      current_round: call.round,
      max_rounds: session.settings.max_rounds,
      highest_bid: before?.price ?? 0,
      leader: before?.leader ?? null,
    },
    you: entry.name,
    required_items: [...session.required_items],
    players: rosterBefore(session, lot.number).map((p) => ({
      name: p.name,
      budget: p.budget ?? session.settings.budget,
      items: p.items.map((it) => ({ item: it.item, quality: it.quality, required: it.required })),
    })),
    remaining_lots: session.settings.lots_count - lot.number,
  }
}

function roundWinner(bids: SessionBid[], call: SessionBid): string | null {
  return (
    bids.find((b) => b.lot_number === call.lot_number && b.round === call.round && (b.outcome === 'leading' || b.won))
      ?.player_id ?? null
  )
}

/** Why the call counted or not, in one sentence. */
export function explainCall(call: SessionBid, state: AgentState, budget: number, bids: SessionBid[]): string {
  const price = state.auction.highest_bid
  const bid = call.bid ?? 0
  const leading = state.auction.leader === state.you
  if (call.won) {
    return `Counted. ${bid} beat ${price} and nobody topped it afterwards, so it bought the lot for ${bid}.`
  }
  switch (call.outcome) {
    case 'leading':
      return `Counted. ${bid} beat the highest bid of ${price}, fit the budget of ${budget} and was the best bid of the round.`
    case 'outbid': {
      const winner = roundWinner(bids, call)
      return `Counted, but ${winner ?? 'another agent'} bid more in the same round.`
    }
    case 'pass':
      return leading
        ? `Passed while already leading at ${price}.`
        : price > 0
          ? `Passed. The highest bid was ${price}, held by ${state.auction.leader}.`
          : 'Passed before anyone had bid.'
    case 'not_higher':
      return `Ignored. ${bid} is not higher than the highest bid of ${price}.`
    case 'over_budget':
      return `Ignored. ${bid} is more than its budget of ${budget}.`
    default:
      if (call.failure === 'unreadable') return 'Ignored. The reply had no readable JSON with a bid.'
      if (call.failure === 'no_reply' || (call.response_ms ?? 0) >= 30000) {
        return (call.response_ms ?? 0) >= 30000 ? 'No reply within 30 seconds.' : 'The model returned an error, so there was no reply.'
      }
      return 'No usable answer: the model timed out, failed or replied without a readable bid.'
  }
}

export function buildAgentView(session: GameSession, bids: SessionBid[], call: SessionBid): AgentView | null {
  const entry = session.roster.find((e) => belongsTo(call, e))
  if (!entry) return null
  const state = buildState(session, bids, call, entry)
  if (!state) return null
  const me = state.players.find((p) => p.name === entry.name) ?? { name: entry.name, budget: session.settings.budget, items: [] }
  const copies = me.items.filter((it) => it.item === state.lot.item)
  const ownedCopy = copies.length ? copies.reduce((best, it) => (it.quality > best.quality ? it : best)) : null
  return {
    entry,
    state,
    message: buildUserMessage(entry.prompt_text ?? '', state),
    me,
    ownedCopy,
    explanation: explainCall(call, state, me.budget, bids),
  }
}

/** All calls of one agent in play order, for stepping through its answers. */
export function callsOf(bids: SessionBid[], call: SessionBid): SessionBid[] {
  const key = playerKey(call)
  return bids
    .filter((b) => playerKey(b) === key)
    .sort((a, b) => a.lot_number - b.lot_number || a.round - b.round)
}

export function sameCall(a: SessionBid, b: SessionBid): boolean {
  return a.lot_number === b.lot_number && a.round === b.round && playerKey(a) === playerKey(b)
}
