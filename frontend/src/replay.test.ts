import { describe, expect, it } from 'vitest'

import {
  agentDiary,
  belongsTo,
  bidsOfLot,
  callsUpTo,
  initials,
  rosterBefore,
  roundStates,
  roundsPlayed,
  summarizeDiary,
} from './replay'
import { bid, liveSession, lot } from './test/liveFixtures'

const lotOne = [
  bid({ round: 1, player_id: 'Aurelia', player_ref: 'p1', bid: 10, outcome: 'leading' }),
  bid({ round: 1, player_id: 'Kestrel', player_ref: 'p2', bid: 5, outcome: 'outbid' }),
  bid({ round: 2, player_id: 'Kestrel', player_ref: 'p2', bid: 40, outcome: 'leading', won: true }),
  bid({ round: 2, player_id: 'Aurelia', player_ref: 'p1', bid: 0, outcome: 'pass' }),
  bid({ round: 3, player_id: 'Aurelia', player_ref: 'p1', bid: 0, outcome: 'pass' }),
  bid({ round: 3, player_id: 'Kestrel', player_ref: 'p2', bid: null, outcome: 'no_answer', response_ms: 30000 }),
]

describe('round replay', () => {
  it('filters a lot and counts its rounds', () => {
    expect(bidsOfLot([...lotOne, bid({ lot_number: 2 })], 1)).toHaveLength(6)
    expect(roundsPlayed(lotOne)).toBe(3)
    expect(roundsPlayed([])).toBe(0)
  })

  it('tracks price and leader after each round', () => {
    expect(roundStates(lotOne)).toEqual([
      { round: 1, price: 10, leader: 'Aurelia', leaderRef: 'p1', raised: true },
      { round: 2, price: 40, leader: 'Kestrel', leaderRef: 'p2', raised: true },
      { round: 3, price: 40, leader: 'Kestrel', leaderRef: 'p2', raised: false },
    ])
  })

  it('keeps the price when a lead bid has no amount', () => {
    expect(roundStates([bid({ bid: null, outcome: 'leading' })])[0].price).toBe(0)
  })

  it("gives each agent's latest call up to a round", () => {
    const calls = callsUpTo(lotOne, 2)
    expect(calls.get('p1')?.outcome).toBe('pass')
    expect(calls.get('p2')?.bid).toBe(40)
    expect(callsUpTo(lotOne, 1).get('p2')?.bid).toBe(5)
  })
})

describe('rosterBefore', () => {
  it('rolls budgets and items back to the moment the lot came up', () => {
    const session = liveSession()
    const before = rosterBefore(session, 3)
    expect(before[0].budget).toBe(900)
    expect(before[0].items.map((i) => i.item)).toEqual(['Golem Core'])
    expect(rosterBefore(session, 1)[0]).toMatchObject({ budget: 1000, items: [] })
  })
})

describe('agentDiary', () => {
  const session = liveSession({
    lots: [
      lot({ number: 1, status: 'sold', sold_to: 'p2', sold_to_name: 'Kestrel', price: 40 }),
      lot({ number: 2, status: 'sold', sold_to: 'p1', sold_to_name: 'Aurelia', price: 30 }),
      lot({ number: 3, status: 'unsold' }),
      lot({ number: 4 }),
      lot({ number: 5 }),
    ],
  })
  const bids = [
    ...lotOne,
    bid({ lot_number: 2, round: 1, bid: 30, outcome: 'leading', won: true, player_ref: 'p1', response_ms: 1000 }),
    bid({ lot_number: 3, round: 1, bid: 9000, outcome: 'over_budget', player_ref: 'p1' }),
    bid({ lot_number: 4, round: 1, bid: 0, outcome: 'pass', player_ref: 'p1' }),
  ]

  it('tells how every lot went for one agent', () => {
    const diary = agentDiary(session, bids, session.roster[0])
    expect(diary.map((e) => [e.lot.number, e.result, e.topBid, e.calls.length])).toEqual([
      [1, 'outbid', 10, 3],
      [2, 'bought', 30, 1],
      [3, 'stayed_out', 0, 1],
      [4, 'in_play', 0, 1],
    ])
  })

  it('sums the diary up', () => {
    const summary = summarizeDiary(agentDiary(session, bids, session.roster[0]))
    expect(summary).toMatchObject({ bought: 1, spent: 30, valid: 2, passes: 3, rejected: 1, silent: 0 })
    expect(summary.avgSeconds).toBeCloseTo(7 / 6)
    expect(summarizeDiary([]).avgSeconds).toBeNull()
  })

  it('matches a call by name when it has no player ref', () => {
    expect(belongsTo(bid({ player_ref: null, player_id: 'Aurelia' }), { player_ref: 'p1', name: 'Aurelia' })).toBe(true)
    expect(belongsTo(bid({ player_ref: 'p2' }), { player_ref: 'p1', name: 'Aurelia' })).toBe(false)
  })
})

describe('initials', () => {
  it('takes two letters', () => {
    expect(initials('Kamil-TEST')).toBe('KT')
    expect(initials('Aurelia')).toBe('AU')
    expect(initials('wren the bold')).toBe('WT')
  })
})
