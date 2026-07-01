import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LeaderboardInventory } from './LeaderboardInventory'

describe('LeaderboardInventory', () => {
  it('renders each entry with win rate and items', () => {
    render(
      <LeaderboardInventory
        entries={[
          { playerId: 'p1', winRate: 67, items: ['Crystal Fox', 'Nebula Coin'] },
          { playerId: 'p2', winRate: 50, items: [] },
        ]}
      />,
    )
    expect(screen.getByText('Leaderboard & Inventory')).toBeInTheDocument()
    expect(screen.getByText('p1 • Win Rate: 67%')).toBeInTheDocument()
    expect(screen.getByText('Crystal Fox')).toBeInTheDocument()
    expect(screen.getByText('Nebula Coin')).toBeInTheDocument()
    expect(screen.getByText('p2 • Win Rate: 50%')).toBeInTheDocument()
  })

  it('renders nothing extra when there are no entries', () => {
    render(<LeaderboardInventory entries={[]} />)
    expect(screen.getByText('Leaderboard & Inventory')).toBeInTheDocument()
  })
})
