import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PlayerInventories } from './PlayerInventories'

describe('PlayerInventories', () => {
  it('renders each player with the lots they hold', () => {
    render(
      <PlayerInventories
        players={[{ playerId: 'p1', winRate: 67, items: ['Crystal Fox', 'Nebula Coin'] }]}
      />,
    )
    expect(screen.getByText('Inventories')).toBeInTheDocument()
    expect(screen.getByText('2 lots held')).toBeInTheDocument()
    expect(screen.getByText('p1')).toBeInTheDocument()
    expect(screen.getByText('Crystal Fox')).toBeInTheDocument()
    expect(screen.getByText('Nebula Coin')).toBeInTheDocument()
  })

  it('marks a player holding nothing', () => {
    render(<PlayerInventories players={[{ playerId: 'p2', winRate: 0, items: [] }]} />)
    expect(screen.getByText('Holding nothing')).toBeInTheDocument()
  })

  it('shows an empty state when nobody has won a lot', () => {
    render(<PlayerInventories players={[]} />)
    expect(screen.getByText('Nothing has been won yet.')).toBeInTheDocument()
  })
})
