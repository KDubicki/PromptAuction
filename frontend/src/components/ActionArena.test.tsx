import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ActionArena } from './ActionArena'

describe('ActionArena', () => {
  it('renders the lot on the block and the revealed bids', () => {
    render(
      <ActionArena
        currentItem="Crystal Fox"
        liveBids={[
          { player: 'p1', bid: 31 },
          { player: 'p2', bid: 29 },
        ]}
      />,
    )
    expect(screen.getByText('Action arena')).toBeInTheDocument()
    expect(screen.getByText('Crystal Fox')).toBeInTheDocument()
    expect(screen.getByText('p1 · 31')).toBeInTheDocument()
    expect(screen.getByText('p2 · 29')).toBeInTheDocument()
  })

  it('pads the lot slug with its position in the run', () => {
    render(<ActionArena currentItem="Crystal Fox" liveBids={[]} lotIndex={4} lotTotal={45} />)
    expect(screen.getByText('Lot 04 / 45')).toBeInTheDocument()
  })

  it('shows an empty state when no agent has bid', () => {
    render(<ActionArena currentItem="Nebula Coin" liveBids={[]} />)
    expect(screen.getByText('Nebula Coin')).toBeInTheDocument()
    expect(screen.getByText('No agents have bid on this lot yet.')).toBeInTheDocument()
  })
})
