import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { GamePage } from './GamePage'

describe('GamePage', () => {
  it('renders the dashboard sections with their seed data', () => {
    render(<GamePage />)
    expect(screen.getByText('Live Game Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Live Game State')).toBeInTheDocument()
    expect(screen.getByText('Action Arena')).toBeInTheDocument()
    expect(screen.getByText('Leaderboard & Inventory')).toBeInTheDocument()
    expect(screen.getByText('Player Inventories')).toBeInTheDocument()
    expect(screen.getByText('Bidding History')).toBeInTheDocument()
  })
})
