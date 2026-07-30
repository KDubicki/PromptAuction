import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BidLadder } from './BidLadder'

const BIDS = [
  { player: 'p1', amount: 31 },
  { player: 'p2', amount: 29 },
  { player: 'p3', amount: 12 },
]

describe('BidLadder', () => {
  it('keeps bids sealed until the iteration resolves', () => {
    render(<BidLadder bids={BIDS} revealed={false} />)
    expect(screen.getByText('3 sealed bids')).toBeInTheDocument()
    // Paddle IDs are visible; the amounts are not.
    expect(screen.getByText('p1')).toBeInTheDocument()
    expect(screen.queryByText('p1 · 31')).not.toBeInTheDocument()
    expect(screen.getByRole('group')).toHaveAccessibleName('3 sealed bids awaiting reveal.')
  })

  it('reveals amounts and reports the margin over the runner-up', () => {
    render(<BidLadder bids={BIDS} revealed />)
    expect(screen.getByText('Hammer down')).toBeInTheDocument()
    expect(screen.getByText('p1 · 31')).toBeInTheDocument()
    expect(screen.getByText('p3 · 12')).toBeInTheDocument()
    expect(screen.getByText('p1 won by 2 over p2')).toBeInTheDocument()
    expect(screen.getByRole('group')).toHaveAccessibleName('Revealed bids. Hammer price 31 by p1.')
  })

  it('reports a single bid as unopposed', () => {
    render(<BidLadder bids={[{ player: 'solo', amount: 40 }]} revealed />)
    expect(screen.getByText('solo won unopposed')).toBeInTheDocument()
  })

  it('derives axis labels from the highest bid', () => {
    render(<BidLadder bids={BIDS} revealed />)
    // 31 rounds up to a ceiling of 40, so the axis reads 0 / 10 / 20 / 30 / 40.
    expect(screen.getByText('40')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  it('honours an explicit scale ceiling', () => {
    render(<BidLadder bids={BIDS} revealed scaleMax={100} />)
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('handles a zero-value bid without collapsing the scale', () => {
    render(<BidLadder bids={[{ player: 'p1', amount: 0 }]} revealed />)
    expect(screen.getByText('p1 · 0')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('shows an empty state when no agent has bid', () => {
    render(<BidLadder bids={[]} revealed />)
    expect(screen.getByText('No agents have bid on this lot yet.')).toBeInTheDocument()
  })

  it('lanes bids that would otherwise collide on the axis', () => {
    // Four bids inside one lane-gap force a wrap back to the first lane.
    const tight = [
      { player: 'a', amount: 90 },
      { player: 'b', amount: 91 },
      { player: 'c', amount: 92 },
      { player: 'd', amount: 93 },
    ]
    render(<BidLadder bids={tight} revealed scaleMax={100} />)
    for (const bid of tight) {
      expect(screen.getByText(`${bid.player} · ${bid.amount}`)).toBeInTheDocument()
    }
  })
})
