import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PlayerInventories } from './PlayerInventories'

describe('PlayerInventories', () => {
  it('renders each player with their items joined by comma', () => {
    render(
      <PlayerInventories
        players={[{ playerId: 'p1', winRate: 67, items: ['Crystal Fox', 'Nebula Coin'] }]}
      />,
    )
    expect(screen.getByText('Player Inventories')).toBeInTheDocument()
    expect(screen.getByText('p1')).toBeInTheDocument()
    expect(screen.getByText('Crystal Fox, Nebula Coin')).toBeInTheDocument()
  })
})
