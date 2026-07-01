import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LeaderboardPage } from './LeaderboardPage'

describe('LeaderboardPage', () => {
  it('renders the mock leaderboard rows', () => {
    render(<LeaderboardPage />)
    expect(screen.getByText('Leaderboard')).toBeInTheDocument()
    expect(screen.getByText('p1')).toBeInTheDocument()
    expect(screen.getByText('p2')).toBeInTheDocument()
    expect(screen.getByText('p3')).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument()
  })
})
