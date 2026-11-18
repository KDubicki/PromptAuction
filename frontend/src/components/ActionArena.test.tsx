import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ActionArena } from './ActionArena'

describe('ActionArena', () => {
  it('leads with the lot and the hammer price, then the revealed bids', () => {
    render(
      <ActionArena
        currentItem="Crystal Fox"
        liveBids={[
          { player: 'p1', bid: 31 },
          { player: 'p2', bid: 29 },
        ]}
        round={2}
        totalRounds={50}
        iteration={15}
        totalIterations={45}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Crystal Fox' })).toBeInTheDocument()
    expect(screen.getByText('Lot 15 of 45, round 2 of 50')).toBeInTheDocument()
    expect(screen.getByText('31')).toBeInTheDocument()
    expect(screen.getByText('p1 · 31')).toBeInTheDocument()
    expect(screen.getByText('p2 · 29')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Round progress' })).toHaveAttribute('aria-valuenow', '33')
  })

  it('holds the hammer price back while bids are sealed', () => {
    render(<ActionArena currentItem="Crystal Fox" liveBids={[{ player: 'p1', bid: 31 }]} revealed={false} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('31')).not.toBeInTheDocument()
  })

  it('shows an empty state when no agent has bid', () => {
    render(<ActionArena currentItem="Nebula Coin" liveBids={[]} totalIterations={0} />)
    expect(screen.getByText('Nebula Coin')).toBeInTheDocument()
    expect(screen.getByText('No agents have bid on this lot yet.')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
})
