import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BiddingHistoryTable } from './BiddingHistoryTable'

describe('BiddingHistoryTable', () => {
  it('renders a row per bid with its outcome', () => {
    render(
      <BiddingHistoryTable
        bids={[
          { player_id: 'p1', item_name: 'Crystal Fox', bid_amount: 28, won: true },
          { player_id: 'p2', item_name: 'Crystal Fox', bid_amount: 19, won: false },
        ]}
      />,
    )
    expect(screen.getByText('Bidding history')).toBeInTheDocument()
    expect(screen.getByText('2 bids')).toBeInTheDocument()
    expect(screen.getByText('p1')).toBeInTheDocument()
    expect(screen.getByText('28')).toBeInTheDocument()
    expect(screen.getByText('Won')).toBeInTheDocument()
    expect(screen.getByText('Outbid')).toBeInTheDocument()
  })

  it('shows an empty state when no bids have been recorded', () => {
    render(<BiddingHistoryTable bids={[]} />)
    expect(screen.getByText('Bidding history')).toBeInTheDocument()
    expect(screen.getByText('No bids recorded yet.')).toBeInTheDocument()
  })
})
