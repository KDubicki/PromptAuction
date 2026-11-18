import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LeaderboardPage } from './LeaderboardPage'

describe('LeaderboardPage', () => {
  it('renders the standings with rank, wins and elo', () => {
    render(<LeaderboardPage />)
    expect(screen.getByRole('heading', { name: 'Leaderboard' })).toBeInTheDocument()
    expect(screen.getByText('Standings')).toBeInTheDocument()
    expect(screen.getByText('Aurelia')).toBeInTheDocument()
    expect(screen.getByText('Kestrel')).toBeInTheDocument()
    expect(screen.getByText('Morrow')).toBeInTheDocument()
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('1450')).toBeInTheDocument()
    expect(screen.getByText('67%')).toBeInTheDocument()
  })
})
