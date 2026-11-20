import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Rostrum } from './Rostrum'
import { lot, liveSession } from '../../test/liveFixtures'

describe('Rostrum', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the lot, its quality, the round and who holds the price', () => {
    const session = liveSession()
    render(<Rostrum session={session} lot={session.lots[1]} />)
    expect(screen.getByRole('heading', { name: 'Golem Core' })).toBeInTheDocument()
    expect(screen.getByText('Lot 2 of 3')).toBeInTheDocument()
    expect(screen.getByText('Required, counts toward winning')).toBeInTheDocument()
    expect(screen.getByRole('meter', { name: 'Quality' })).toHaveAttribute('aria-valuenow', '5')
    expect(screen.getByText('Round 3 of 5')).toBeInTheDocument()
    expect(screen.getByLabelText('Highest bid 120')).toHaveTextContent('120')
    expect(screen.getByText('Aurelia')).toBeInTheDocument()
    expect(screen.getByText('Lot 1, Unicorn Horn, went to Kestrel for 40.')).toBeInTheDocument()
  })

  it('marks the final round and a lot nobody has bid on', () => {
    const session = liveSession({
      auction: { lot_number: 3, current_round: 5, highest_bid: 0, leader_ref: null, leader_name: null, void_rounds: 0 },
      lots: [
        lot({ number: 1, status: 'sold', sold_to_name: 'Kestrel', price: 40 }),
        lot({ number: 2, item: 'Golem Core', status: 'unsold' }),
        lot({ number: 3, item: 'Phoenix Feather', required: false }),
      ],
    })
    render(<Rostrum session={session} lot={session.lots[2]} />)
    expect(screen.getByText('Final round, 5 of 5')).toBeInTheDocument()
    expect(screen.getByText('No bids yet')).toBeInTheDocument()
    expect(screen.getByText('Not required, counts for nothing')).toBeInTheDocument()
    expect(screen.getByText('Lot 2, Golem Core, went unsold.')).toBeInTheDocument()
  })

  it('stamps the closed lot when the auction moves on, then clears it', () => {
    vi.useFakeTimers()
    const before = liveSession({
      lots: [lot({ number: 1 }), lot({ number: 2, item: 'Golem Core' }), lot({ number: 3 })],
      auction: { lot_number: 1, current_round: 2, highest_bid: 40, leader_ref: 'p2', leader_name: 'Kestrel', void_rounds: 0 },
    })
    const { rerender } = render(<Rostrum session={before} lot={before.lots[0]} />)
    expect(screen.queryByText('Sold')).not.toBeInTheDocument()

    const after = liveSession({
      lots: [
        lot({ number: 1, status: 'sold', sold_to_name: 'Kestrel', price: 40 }),
        lot({ number: 2, item: 'Golem Core' }),
        lot({ number: 3 }),
      ],
      auction: { lot_number: 2, current_round: 1, highest_bid: 0, leader_ref: null, leader_name: null, void_rounds: 0 },
    })
    rerender(<Rostrum session={after} lot={after.lots[1]} />)
    expect(screen.getByText('Sold')).toBeInTheDocument()
    expect(screen.getByText('Unicorn Horn goes to Kestrel for 40')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.queryByText('Sold')).not.toBeInTheDocument()
  })

  it('announces an unsold lot too', () => {
    const before = liveSession({ auction: { lot_number: 1, current_round: 1, highest_bid: 0, leader_ref: null, leader_name: null, void_rounds: 0 }, lots: [lot({ number: 1 }), lot({ number: 2 })] })
    const { rerender } = render(<Rostrum session={before} lot={before.lots[0]} />)
    const after = liveSession({ lots: [lot({ number: 1, status: 'unsold' }), lot({ number: 2 })] })
    rerender(<Rostrum session={after} lot={after.lots[1]} />)
    expect(screen.getByText('Unsold')).toBeInTheDocument()
    expect(screen.getByText('Nobody bid on Unicorn Horn')).toBeInTheDocument()
  })

  it('works without an auction state', () => {
    const session = liveSession({ auction: null })
    render(<Rostrum session={session} lot={session.lots[2]} />)
    expect(screen.queryByText(/Round/)).not.toBeInTheDocument()
    expect(screen.getByText('No bids yet')).toBeInTheDocument()
  })
})
