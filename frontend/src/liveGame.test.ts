import { describe, expect, it } from 'vitest'

import {
  currentLot,
  describeCall,
  formatSeconds,
  groupRounds,
  latestCalls,
  pickSession,
  watchableSessions,
} from './liveGame'
import { bid, liveSession } from './test/liveFixtures'

describe('watchableSessions / pickSession', () => {
  const running = liveSession({ id: 'run' })
  const paused = liveSession({ id: 'pause', status: 'paused' })
  const oldDone = liveSession({ id: 'old', status: 'completed', started_at: '2026-11-01T10:00:00' })
  const newDone = liveSession({ id: 'new', status: 'completed', started_at: '2026-11-19T10:00:00' })
  const pending = liveSession({ id: 'pend', status: 'pending', lots: [] })

  it('drops sessions without lots and puts running first, then the latest finished', () => {
    expect(watchableSessions([pending, oldDone, newDone, paused, running]).map((s) => s.id)).toEqual([
      'run',
      'pause',
      'new',
      'old',
    ])
  })

  it('treats a missing start time as oldest', () => {
    const undated = liveSession({ id: 'undated', status: 'completed', started_at: null })
    expect(watchableSessions([undated, newDone]).map((s) => s.id)).toEqual(['new', 'undated'])
  })

  it('honours the requested session and falls back to the best one', () => {
    expect(pickSession([running, newDone], 'new')?.id).toBe('new')
    expect(pickSession([running, newDone], 'missing')?.id).toBe('run')
    expect(pickSession([pending], null)).toBeNull()
  })
})

describe('currentLot', () => {
  it('is the lot under the hammer, or the last lot once the auction ends', () => {
    expect(currentLot(liveSession())?.number).toBe(2)
    expect(currentLot(liveSession({ auction: null }))?.number).toBe(3)
    expect(currentLot(liveSession({ auction: null, lots: [] }))).toBeNull()
  })
})

describe('groupRounds / latestCalls', () => {
  const bids = [
    bid({ round: 1, player_id: 'Aurelia', response_ms: 900 }),
    bid({ round: 1, player_id: 'Kestrel', player_ref: 'p2', response_ms: 300 }),
    bid({ round: 2, player_id: 'Kestrel', player_ref: 'p2', response_ms: null, outcome: 'no_answer', bid: null }),
    bid({ round: 2, player_id: 'Aurelia', response_ms: 500 }),
  ]

  it('lists the newest round first, answers in arrival order', () => {
    const rounds = groupRounds(bids)
    expect(rounds.map((r) => r.round)).toEqual([2, 1])
    expect(rounds[0].calls.map((c) => c.player_id)).toEqual(['Aurelia', 'Kestrel'])
    expect(rounds[1].calls.map((c) => c.player_id)).toEqual(['Kestrel', 'Aurelia'])
  })

  it("keeps each agent's latest call, keyed by player ref or name", () => {
    const latest = latestCalls([...bids, bid({ round: 1, player_ref: null, player_id: 'Ghost' })])
    expect(latest.get('p1')?.round).toBe(2)
    expect(latest.get('p2')?.outcome).toBe('no_answer')
    expect(latest.get('Ghost')?.round).toBe(1)
  })
})

describe('describeCall', () => {
  it.each([
    [{ won: true }, 'Bids 10', 'Wins the lot', 'won'],
    [{ outcome: 'leading' }, 'Bids 10', 'Takes the lead', 'lead'],
    [{ outcome: 'outbid' }, 'Bids 10', 'Outbid', 'plain'],
    [{ outcome: 'pass', bid: 0 }, 'Passes', null, 'muted'],
    [{ outcome: 'not_higher' }, 'Bids 10', 'Too low', 'rejected'],
    [{ outcome: 'over_budget' }, 'Bids 10', 'Over budget', 'rejected'],
    [{ outcome: 'no_answer', bid: null }, 'No answer', null, 'muted'],
  ])('%o reads as %s', (overrides, text, tag, tone) => {
    expect(describeCall(bid(overrides))).toEqual({ text, tag, tone })
  })

  it('shows a missing amount as zero', () => {
    expect(describeCall(bid({ outcome: 'outbid', bid: null })).text).toBe('Bids 0')
  })
})

describe('formatSeconds', () => {
  it('formats milliseconds as seconds', () => {
    expect(formatSeconds(7374)).toBe('7.4 s')
    expect(formatSeconds(null)).toBeNull()
  })
})
