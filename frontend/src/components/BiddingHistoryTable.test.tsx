import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BiddingHistoryTable } from './BiddingHistoryTable'

describe('BiddingHistoryTable', () => {
  it('renders a row per bid, showing Yes/No for won', () => {
    render(
      <BiddingHistoryTable
        bids={[
          { player_id: 'p1', item_name: 'Crystal Fox', bid_amount: 28, won: true },
          { player_id: 'p2', item_name: 'Crystal Fox', bid_amount: 19, won: false },
        ]}
      />,
    )
    expect(screen.getByText('Bidding History')).toBeInTheDocument()
    expect(screen.getByText('p1')).toBeInTheDocument()
    expect(screen.getByText('28')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('renders an empty table when there are no bids', () => {
    render(<BiddingHistoryTable bids={[]} />)
    expect(screen.getByText('Bidding History')).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /p1/ })).not.toBeInTheDocument()
  })
})
