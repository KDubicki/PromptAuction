import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { GamePage } from './GamePage'

describe('GamePage', () => {
  it('renders the arena and its supporting panels', () => {
    render(<GamePage />)
    expect(screen.getByRole('heading', { name: 'Live game' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Leaderboard' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Bidding history' })).toBeInTheDocument()
  })

  it('leads with the lot on the block and its hammer price', () => {
    render(<GamePage />)
    expect(screen.getByRole('heading', { name: 'Crystal Fox' })).toBeInTheDocument()
    expect(screen.getByText('Aurelia · 31')).toBeInTheDocument()
  })
})
