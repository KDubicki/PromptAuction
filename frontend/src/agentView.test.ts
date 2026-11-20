import { describe, expect, it } from 'vitest'

import { buildAgentView, buildState, buildUserMessage, callsOf, explainCall, sameCall, type AgentState } from './agentView'
import { bid, liveSession, lot } from './test/liveFixtures'

const session = liveSession({
  lots: [
    lot({ number: 1, item: 'Golem Core', status: 'sold', sold_to: 'p1', sold_to_name: 'Aurelia', price: 100 }),
    lot({ number: 2, item: 'Golem Core', quality: 8, status: 'sold', sold_to: 'p2', sold_to_name: 'Kestrel', price: 60 }),
    lot({ number: 3 }),
  ],
})
session.roster[0] = {
  ...session.roster[0],
  prompt_text: 'Be bold.',
  items: [{ item: 'Golem Core', quality: 5, required: true, lot_number: 1, price: 100 }],
}
session.roster[1] = { ...session.roster[1], items: [{ item: 'Golem Core', quality: 8, required: true, lot_number: 2, price: 60 }] }

const lotTwo = [
  bid({ lot_number: 2, round: 1, bid: 30, outcome: 'leading' }),
  bid({ lot_number: 2, round: 1, player_id: 'Kestrel', player_ref: 'p2', bid: 20, outcome: 'outbid' }),
  bid({ lot_number: 2, round: 2, player_id: 'Kestrel', player_ref: 'p2', bid: 60, outcome: 'leading', won: true }),
  bid({ lot_number: 2, round: 2, bid: 50, outcome: 'outbid' }),
  bid({ lot_number: 2, round: 3, bid: 0, outcome: 'pass' }),
]

describe('buildState', () => {
  it('rebuilds exactly what the engine sent for a call', () => {
    expect(buildState(session, lotTwo, lotTwo[4], session.roster[0])).toEqual({
      lot: { number: 2, of: 3, item: 'Golem Core', quality: 8, required: true },
      auction: { current_round: 3, max_rounds: 5, highest_bid: 60, leader: 'Kestrel' },
      you: 'Aurelia',
      required_items: ['Unicorn Horn', 'Golem Core'],
      players: [
        { name: 'Aurelia', budget: 900, items: [{ item: 'Golem Core', quality: 5, required: true }] },
        { name: 'Kestrel', budget: 1000, items: [] },
      ],
      remaining_lots: 1,
    })
  })

  it('starts the first round with no price and no leader', () => {
    const state = buildState(session, lotTwo, lotTwo[0], session.roster[0])
    expect(state?.auction).toEqual({ current_round: 1, max_rounds: 5, highest_bid: 0, leader: null })
  })

  it('gives up on an unknown lot', () => {
    expect(buildState(session, [], bid({ lot_number: 99 }), session.roster[0])).toBeNull()
  })

  it('falls back to the starting budget when a roster budget is missing', () => {
    const odd = { ...session, roster: [{ ...session.roster[0], items: [], budget: null }] }
    const s = { ...odd, settings: { ...odd.settings } }
    expect(buildState(s, [], bid({ lot_number: 1 }), s.roster[0])?.players[0].budget).toBe(1000)
  })
})

describe('buildUserMessage', () => {
  it('matches the backend layout', () => {
    const state = { lot: { number: 1 } } as unknown as AgentState
    expect(buildUserMessage('Be bold.', state)).toBe(
      'Your player\'s instructions:\n<<<\nBe bold.\n>>>\n\nGame state:\n```json\n{\n  "lot": {\n    "number": 1\n  }\n}\n```',
    )
  })
})

describe('explainCall', () => {
  const state = buildState(session, lotTwo, lotTwo[3], session.roster[0]) as AgentState

  it.each([
    [{ won: true, bid: 60 }, 'Counted. 60 beat 30 and nobody topped it afterwards, so it bought the lot for 60.'],
    [{ outcome: 'leading', bid: 50 }, 'Counted. 50 beat the highest bid of 30, fit the budget of 900 and was the best bid of the round.'],
    [{ outcome: 'outbid', bid: 50 }, 'Counted, but Kestrel bid more in the same round.'],
    [{ outcome: 'not_higher', bid: 20 }, 'Ignored. 20 is not higher than the highest bid of 30.'],
    [{ outcome: 'over_budget', bid: 5000 }, 'Ignored. 5000 is more than its budget of 900.'],
    [{ outcome: 'no_answer', failure: 'unreadable' as const }, 'Ignored. The reply had no readable JSON with a bid.'],
    [{ outcome: 'no_answer', failure: 'no_reply' as const, response_ms: 30001 }, 'No reply within 30 seconds.'],
    [{ outcome: 'no_answer', failure: 'no_reply' as const, response_ms: 900 }, 'The model returned an error, so there was no reply.'],
    [{ outcome: 'no_answer', response_ms: 30500 }, 'No reply within 30 seconds.'],
    [{ outcome: 'no_answer', response_ms: null }, 'No usable answer: the model timed out, failed or replied without a readable bid.'],
  ])('%o', (overrides, text) => {
    expect(explainCall(bid({ lot_number: 2, round: 2, ...overrides }), state, 900, lotTwo)).toBe(text)
  })

  it('names nobody when the round had no leader on record', () => {
    expect(explainCall(bid({ lot_number: 9, outcome: 'outbid' }), state, 900, [])).toBe('Counted, but another agent bid more in the same round.')
  })

  it('tells the three kinds of pass apart', () => {
    const passing = bid({ lot_number: 2, outcome: 'pass', bid: 0 })
    expect(explainCall(passing, state, 900, lotTwo)).toBe('Passed while already leading at 30.')
    const rival = { ...state, auction: { ...state.auction, leader: 'Kestrel' } }
    expect(explainCall(passing, rival, 900, lotTwo)).toBe('Passed. The highest bid was 30, held by Kestrel.')
    const fresh = { ...state, auction: { ...state.auction, leader: null, highest_bid: 0 } }
    expect(explainCall(passing, fresh, 900, lotTwo)).toBe('Passed before anyone had bid.')
  })
})

describe('buildAgentView', () => {
  it('adds the message, its own position and the copy it already had', () => {
    const view = buildAgentView(session, lotTwo, lotTwo[4])!
    expect(view.entry.name).toBe('Aurelia')
    expect(view.me.budget).toBe(900)
    expect(view.ownedCopy).toEqual({ item: 'Golem Core', quality: 5, required: true })
    expect(view.message).toContain('Be bold.')
    expect(view.message).toContain('"highest_bid": 60')
    expect(view.explanation).toBe('Passed. The highest bid was 60, held by Kestrel.')
  })

  it('keeps the best copy when it owns several', () => {
    const many = {
      ...session,
      roster: [
        {
          ...session.roster[0],
          items: [
            { item: 'Golem Core', quality: 5, required: true, lot_number: 1, price: 1 },
            { item: 'Golem Core', quality: 9, required: true, lot_number: 1, price: 1 },
            { item: 'Golem Core', quality: 7, required: true, lot_number: 1, price: 1 },
          ],
        },
        session.roster[1],
      ],
    }
    expect(buildAgentView(many, lotTwo, lotTwo[4])?.ownedCopy?.quality).toBe(9)
  })

  it('uses an empty prompt and empty position when needed, and nothing for strangers', () => {
    const bare = { ...session, roster: [{ ...session.roster[0], prompt_text: null, items: [] }] }
    const view = buildAgentView(bare, [], bid({ lot_number: 1, round: 1 }))!
    expect(view.message.startsWith("Your player's instructions:\n<<<\n\n>>>")).toBe(true)
    expect(view.ownedCopy).toBeNull()
    expect(buildAgentView(session, [], bid({ player_ref: 'ghost', player_id: 'Ghost' }))).toBeNull()
    expect(buildAgentView(session, [], bid({ lot_number: 99 }))).toBeNull()
  })

  it('falls back to a blank position when the agent is missing from the rebuilt roster', () => {
    const renamed = { ...session, roster: [{ ...session.roster[0] }] }
    const original = renamed.roster[0]
    const view = buildAgentView(
      { ...renamed, roster: [{ ...original, name: 'Aurelia' }] },
      [],
      bid({ lot_number: 1, player_ref: 'p1' }),
    )
    expect(view?.me.name).toBe('Aurelia')
  })
})

describe('callsOf / sameCall', () => {
  it('lists one agent’s calls in play order', () => {
    const all = [bid({ lot_number: 2, round: 1 }), bid({ lot_number: 1, round: 2 }), bid({ lot_number: 1, round: 1 }), bid({ player_ref: 'p2' })]
    expect(callsOf(all, all[0]).map((c) => `${c.lot_number}.${c.round}`)).toEqual(['1.1', '1.2', '2.1'])
    expect(sameCall(all[0], { ...all[0] })).toBe(true)
    expect(sameCall(all[0], all[1])).toBe(false)
  })
})
