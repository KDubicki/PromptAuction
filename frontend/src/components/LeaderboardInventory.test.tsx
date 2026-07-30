import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LeaderboardInventory } from './LeaderboardInventory'

describe('LeaderboardInventory', () => {
  it('ranks entries by win rate and lists the lots they hold', () => {
    render(
      <LeaderboardInventory
        entries={[
          { playerId: 'p2', winRate: 50, items: [] },
          { playerId: 'p1', winRate: 67, items: ['Crystal Fox', 'Nebula Coin'] },
        ]}
      />,
    )
    expect(screen.getByText('Leaderboard')).toBeInTheDocument()
    expect(screen.getByText('2 agents')).toBeInTheDocument()
    expect(screen.getByText('67% won')).toBeInTheDocument()
    expect(screen.getByText('50% won')).toBeInTheDocument()
    expect(screen.getByText('Crystal Fox')).toBeInTheDocument()

    // Highest win rate takes rank 01 regardless of input order.
    const rows = screen.getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('p1')
    expect(rows[0]).toHaveTextContent('01')
    expect(rows[1]).toHaveTextContent('p2')
  })

  it('shows an empty state when no agent is ranked', () => {
    render(<LeaderboardInventory entries={[]} />)
    expect(screen.getByText('No agents ranked yet.')).toBeInTheDocument()
  })
})
