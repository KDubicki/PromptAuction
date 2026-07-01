import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ActionArena } from './ActionArena'

describe('ActionArena', () => {
  it('renders the current item and the live bid feed', () => {
    render(
      <ActionArena
        currentItem="Crystal Fox"
        liveBids={[
          { player: 'p1', bid: 31 },
          { player: 'p2', bid: 29 },
        ]}
      />,
    )
    expect(screen.getByText('Current Item: Crystal Fox')).toBeInTheDocument()
    expect(screen.getByText('p1 bids 31 credits')).toBeInTheDocument()
    expect(screen.getByText('p2 bids 29 credits')).toBeInTheDocument()
  })

  it('renders an empty feed when there are no live bids', () => {
    render(<ActionArena currentItem="Nebula Coin" liveBids={[]} />)
    expect(screen.getByText('Current Item: Nebula Coin')).toBeInTheDocument()
    expect(screen.queryByText(/bids/)).not.toBeInTheDocument()
  })
})
