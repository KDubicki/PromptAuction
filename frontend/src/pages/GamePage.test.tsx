import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GamePage } from './GamePage'
import * as hooks from '../api/hooks'
import { renderWithProviders } from '../test/test-utils'
import { bid, liveSession } from '../test/liveFixtures'
import type { GameSession } from '../types'

vi.mock('../api/hooks', () => ({
  useGameSessions: vi.fn(),
  useSessionBids: vi.fn(),
}))

function setup(sessions: GameSession[], bids = [bid({ lot_number: 2, round: 3, bid: 120, reason: 'Need it.' })]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(hooks.useGameSessions).mockReturnValue({ data: sessions } as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(hooks.useSessionBids).mockReturnValue({ data: bids } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GamePage', () => {
  it('invites the admin to start a session when there is nothing to watch', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(hooks.useGameSessions).mockReturnValue({ data: undefined } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(hooks.useSessionBids).mockReturnValue({ data: undefined } as any)
    renderWithProviders(<GamePage />)
    expect(screen.getByRole('heading', { name: 'Live game' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No auction to watch yet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Admin' })).toHaveAttribute('href', '/admin')
  })

  it('shows the running auction and polls the bids of the lot on the block', () => {
    setup([liveSession()])
    renderWithProviders(<GamePage />)
    expect(screen.getByText('live')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Golem Core' })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Aurelia, leading' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lot 2, round by round' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Standings' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lots' })).toBeInTheDocument()
    expect(hooks.useSessionBids).toHaveBeenCalledWith('s1', 2, true)
    expect(screen.queryByRole('combobox', { name: 'Session' })).not.toBeInTheDocument()
  })

  it('explains a pause', () => {
    setup([liveSession({ status: 'paused', pause_reason: 'No answers for 3 rounds.' })])
    renderWithProviders(<GamePage />)
    expect(screen.getByRole('alert')).toHaveTextContent('No answers for 3 rounds. Resume it in Admin to continue.')
    expect(hooks.useSessionBids).toHaveBeenCalledWith('s1', 2, false)
  })

  it('falls back to a generic pause message', () => {
    setup([liveSession({ status: 'paused' })])
    renderWithProviders(<GamePage />)
    expect(screen.getByRole('alert')).toHaveTextContent('The admin paused this auction.')
  })

  it('crowns the winner of a finished session and lets the viewer switch sessions', async () => {
    const done = liveSession({ id: 'done', name: 'Last week', status: 'completed', auction: null })
    setup([done, liveSession()])
    renderWithProviders(<GamePage />, { route: '/?session=done' })
    expect(screen.getByRole('heading', { name: 'Aurelia wins' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('combobox', { name: 'Session' }))
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Evening match (live)'))
    expect(screen.getByRole('heading', { name: 'Golem Core' })).toBeInTheDocument()
  })
})
