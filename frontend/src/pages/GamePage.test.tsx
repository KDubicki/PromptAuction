import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GamePage } from './GamePage'
import * as hooks from '../api/hooks'
import { renderWithProviders } from '../test/test-utils'
import { bid, liveSession, lot } from '../test/liveFixtures'
import type { GameSession, SessionBid } from '../types'

vi.mock('../api/hooks', () => ({
  useGameSessions: vi.fn(),
  useSessionBids: vi.fn(),
}))

function setup(sessions: GameSession[] | undefined, bids: SessionBid[] | undefined = []) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(hooks.useGameSessions).mockReturnValue({ data: sessions } as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(hooks.useSessionBids).mockReturnValue({ data: bids } as any)
}

const liveBids = [
  bid({ lot_number: 1, round: 1, bid: 40, player_id: 'Kestrel', player_ref: 'p2', outcome: 'leading', won: true }),
  bid({ lot_number: 2, round: 3, bid: 120, reason: 'Need it.' }),
]

/** A finished game: lot 1 sold over two rounds, lot 2 sold in one, lot 3 unsold. */
const finished = liveSession({
  id: 'done',
  name: 'Last week',
  status: 'completed',
  auction: null,
  lots: [
    lot({ number: 1, status: 'sold', sold_to: 'p2', sold_to_name: 'Kestrel', price: 40, sold_in_round: 2 }),
    lot({ number: 2, item: 'Golem Core', status: 'sold', sold_to: 'p1', sold_to_name: 'Aurelia', price: 100, sold_in_round: 1 }),
    lot({ number: 3, item: 'Phoenix Feather', status: 'unsold' }),
  ],
})
const finishedBids = [
  bid({ lot_number: 1, round: 1, bid: 10, outcome: 'leading', reason: 'Opening.' }),
  bid({ lot_number: 1, round: 1, player_id: 'Kestrel', player_ref: 'p2', bid: 5, outcome: 'outbid' }),
  bid({ lot_number: 1, round: 2, player_id: 'Kestrel', player_ref: 'p2', bid: 40, outcome: 'leading', won: true, reason: 'Mine.' }),
  bid({ lot_number: 1, round: 2, bid: 0, outcome: 'pass', reason: 'Too rich.' }),
  bid({ lot_number: 2, round: 1, bid: 100, outcome: 'leading', won: true, reason: 'Golem!' }),
]

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GamePage', () => {
  it('invites the admin to start a session when there is nothing to watch', () => {
    setup(undefined, undefined)
    renderWithProviders(<GamePage />)
    expect(screen.getByRole('heading', { name: 'Live game' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No auction to watch yet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Admin' })).toHaveAttribute('href', '/admin')
  })

  it('follows the running auction and polls the session bids', () => {
    setup([liveSession()], liveBids)
    renderWithProviders(<GamePage />)
    expect(screen.getByText('live')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Golem Core' })).toBeInTheDocument()
    expect(screen.getByLabelText('Highest bid 120')).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Aurelia, leading' })).toHaveTextContent('Need it.')
    expect(screen.getByText('Agents now. Follow one to see everything it answered.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lot 2, round by round' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Standings' })).toBeInTheDocument()
    expect(hooks.useSessionBids).toHaveBeenCalledWith('s1', undefined, true)
    expect(screen.queryByRole('combobox', { name: 'Session' })).not.toBeInTheDocument()
  })

  it('looks back at a closed lot during a live game, then returns to live', async () => {
    setup([liveSession()], liveBids)
    renderWithProviders(<GamePage />)
    await userEvent.click(screen.getByRole('button', { name: /^Lot 1,/ }))
    expect(screen.getByText('Replay, lot 1 of 3')).toBeInTheDocument()
    expect(screen.getByText('Agents as they stood when lot 1 came up. Follow one to see everything it answered.')).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Kestrel, leading' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Back to live' }))
    expect(screen.getByRole('heading', { name: 'Golem Core' })).toBeInTheDocument()
    expect(screen.queryByText(/Replay, lot/)).not.toBeInTheDocument()
  })

  it('explains a pause', () => {
    setup([liveSession({ status: 'paused', pause_reason: 'No answers for 3 rounds.' })])
    renderWithProviders(<GamePage />)
    expect(screen.getByRole('alert')).toHaveTextContent('No answers for 3 rounds. Resume it in Admin to continue.')
    expect(hooks.useSessionBids).toHaveBeenCalledWith('s1', undefined, false)
  })

  it('falls back to a generic pause message', () => {
    setup([liveSession({ status: 'paused' })])
    renderWithProviders(<GamePage />)
    expect(screen.getByRole('alert')).toHaveTextContent('The admin paused this auction.')
  })

  it('crowns the winner, replays from the first lot and lets the viewer switch sessions', async () => {
    setup([finished, liveSession()], finishedBids)
    renderWithProviders(<GamePage />, { route: '/?session=done' })
    expect(screen.getByRole('heading', { name: 'Aurelia wins' })).toBeInTheDocument()
    expect(screen.getByText('Replay, lot 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Sold to Kestrel for 40 in round 2')

    await userEvent.click(screen.getByRole('combobox', { name: 'Session' }))
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Evening match (live)'))
    expect(screen.getByRole('heading', { name: 'Golem Core' })).toBeInTheDocument()
  })

  it('scrubs rounds and follows an agent through the whole game', async () => {
    setup([finished], finishedBids)
    renderWithProviders(<GamePage />, { route: '/?lot=1' })

    await userEvent.click(screen.getByRole('button', { name: 'Round 1: 10, Aurelia leads' }))
    expect(screen.getByText('Round 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Aurelia, leading' })).toHaveTextContent('Opening.')
    expect(screen.queryByText('Mine.')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Follow Aurelia' }))
    const diary = screen.getByRole('heading', { name: 'Aurelia, lot by lot' }).closest('.MuiCard-root') as HTMLElement
    expect(within(diary).getByText('Bought for 100')).toBeInTheDocument()
    expect(within(diary).getByText('Lost to Kestrel at 40')).toBeInTheDocument()

    await userEvent.click(within(diary).getByRole('button', { name: 'Watch lot 2' }))
    expect(screen.getByText('Replay, lot 2 of 3')).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Aurelia, leading' })).toHaveTextContent('Golem!')

    await userEvent.click(screen.getByRole('button', { name: 'Stop following Aurelia' }))
    expect(screen.queryByRole('heading', { name: 'Aurelia, lot by lot' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^Lot 3,/ }))
    expect(screen.getByRole('status')).toHaveTextContent('Unsold, nobody bid')
  })

  it('plays the game back round by round and lot by lot, then stops', () => {
    vi.useFakeTimers()
    setup([finished], finishedBids)
    renderWithProviders(<GamePage />, { route: '/?lot=1' })

    fireEvent.click(screen.getByRole('button', { name: 'Play replay' }))
    expect(screen.getByText('Round 1 of 2')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1300)
    })
    expect(screen.getByText('Round 2 of 2')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2400)
    })
    expect(screen.getByText('Replay, lot 2 of 3')).toBeInTheDocument()
    expect(screen.getByText('Round 1 of 1')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2400)
    })
    expect(screen.getByText('Replay, lot 3 of 3')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2400)
    })
    expect(screen.queryByRole('button', { name: 'Pause replay' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Lot 1,/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Play replay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pause replay' }))
    expect(screen.getByRole('button', { name: 'Play replay' })).toBeInTheDocument()
  })
})
