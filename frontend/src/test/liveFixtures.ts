import type { GameSession, Lot, SessionBid } from '../types'

export function lot(overrides: Partial<Lot> = {}): Lot {
  return {
    number: 1,
    item: 'Unicorn Horn',
    quality: 9,
    required: true,
    status: 'pending',
    sold_to: null,
    sold_to_name: null,
    price: null,
    sold_in_round: null,
    ...overrides,
  }
}

export function bid(overrides: Partial<SessionBid> = {}): SessionBid {
  return {
    lot_number: 1,
    item: 'Unicorn Horn',
    round: 1,
    player_id: 'Aurelia',
    player_ref: 'p1',
    bid: 10,
    reason: 'Opening low.',
    response_ms: 1200,
    outcome: 'leading',
    won: false,
    created_at: null,
    ...overrides,
  }
}

export function liveSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    id: 's1',
    name: 'Evening match',
    status: 'running',
    roster: [
      { player_ref: 'p1', name: 'Aurelia', current_version: 2, version_id: 'v1', version: 2, prompt_text: 'x', budget: 900, items: [
        { item: 'Golem Core', quality: 5, required: true, lot_number: 2, price: 100 },
        { item: 'Phoenix Feather', quality: 3, required: false, lot_number: 3, price: 0 },
      ] },
      { player_ref: 'p2', name: 'Kestrel', current_version: 1, version_id: 'v2', version: 1, prompt_text: 'y', budget: 1000, items: [] },
    ],
    start_blockers: [],
    settings: { budget: 1000, lots_count: 3, max_rounds: 5 },
    required_items: ['Unicorn Horn', 'Golem Core'],
    lots: [
      lot({ number: 1, status: 'sold', sold_to: 'p2', sold_to_name: 'Kestrel', price: 40 }),
      lot({ number: 2, item: 'Golem Core', quality: 5 }),
      lot({ number: 3, item: 'Phoenix Feather', quality: 3, required: false }),
    ],
    auction: { lot_number: 2, current_round: 3, highest_bid: 120, leader_ref: 'p1', leader_name: 'Aurelia', void_rounds: 0 },
    standings: [
      { rank: 1, player_ref: 'p1', name: 'Aurelia', unique_required: 1, quality: 5, budget: 900 },
      { rank: 2, player_ref: 'p2', name: 'Kestrel', unique_required: 0, quality: 0, budget: 1000 },
    ],
    pause_reason: null,
    current_round: 0,
    current_iteration: 0,
    started_at: '2026-11-20T10:00:00',
    ...overrides,
  }
}
