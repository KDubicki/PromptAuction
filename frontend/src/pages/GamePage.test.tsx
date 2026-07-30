import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { GamePage } from './GamePage'

describe('GamePage', () => {
  it('renders the dashboard panels with their seed data', () => {
    render(<GamePage />)
    expect(screen.getByRole('heading', { name: 'Live game' })).toBeInTheDocument()
    expect(screen.getByText('Engine')).toBeInTheDocument()
    expect(screen.getByText('Action arena')).toBeInTheDocument()
    expect(screen.getByText('Leaderboard')).toBeInTheDocument()
    expect(screen.getByText('Inventories')).toBeInTheDocument()
    expect(screen.getByText('Bidding history')).toBeInTheDocument()
  })

  it('leads with the lot on the block', () => {
    render(<GamePage />)
    expect(screen.getByText('On the block')).toBeInTheDocument()
    expect(screen.getByText('p1 · 31')).toBeInTheDocument()
  })
})
