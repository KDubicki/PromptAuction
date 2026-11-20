import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SessionStandings } from './SessionStandings'
import type { GameSession } from '../types'

const session = {
  standings: [
    { rank: 1, player_ref: 'a', name: 'Aurelia', unique_required: 4, quality: 31, budget: 220 },
    { rank: 2, player_ref: 'b', name: 'Bram', unique_required: 3, quality: 20, budget: 500 },
  ],
} as GameSession

describe('SessionStandings', () => {
  it('renders a titled table with a row per player', () => {
    render(<SessionStandings session={session} />)
    expect(screen.getByRole('heading', { name: 'Standings' })).toBeInTheDocument()
    expect(screen.getByText('2 players')).toBeInTheDocument()
    for (const header of ['Rank', 'Player', 'Required items', 'Quality', 'Budget']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument()
    }
    const row = screen.getByRole('row', { name: /Aurelia/ })
    expect(within(row).getByText('4')).toBeInTheDocument()
    expect(within(row).getByText('31')).toBeInTheDocument()
    expect(within(row).getByText('220')).toBeInTheDocument()
  })

  it('sets only rank 1 in brass', () => {
    render(<SessionStandings session={session} />)
    const first = getComputedStyle(screen.getByText('1')).color
    const second = getComputedStyle(screen.getByText('2', { selector: 'span' })).color
    expect(first).not.toBe(second)
  })
})
