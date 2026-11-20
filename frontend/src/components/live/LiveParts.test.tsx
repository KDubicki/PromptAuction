import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AgentSeats } from './AgentSeats'
import { LotBoard } from './LotBoard'
import { RoomTranscript } from './RoomTranscript'
import { WinnerStage } from './WinnerStage'
import { latestCalls } from '../../liveGame'
import { bid, liveSession, lot } from '../../test/liveFixtures'

describe('AgentSeats', () => {
  it('seats every agent with budget, haul and last call, and marks the leader', async () => {
    const calls = latestCalls([
      bid({ round: 3, bid: 120, reason: 'Need this one.' }),
      bid({ round: 3, player_ref: 'p2', player_id: 'Kestrel', outcome: 'over_budget', bid: 5000, reason: null }),
    ])
    const session = liveSession()
    const onFollow = vi.fn()
    render(<AgentSeats roster={session.roster} startBudget={1000} calls={calls} leaderRef="p1" followedRef="p2" onFollow={onFollow} />)

    const aurelia = screen.getByRole('listitem', { name: 'Aurelia, leading' })
    expect(within(aurelia).getByText('Leading')).toBeInTheDocument()
    expect(within(aurelia).getByText('900')).toBeInTheDocument()
    expect(within(aurelia).getByText('Golem Core 5')).toBeInTheDocument()
    expect(within(aurelia).getByText('Phoenix Feather 3')).toHaveAttribute('title', 'Phoenix Feather, quality 3, not required')
    expect(within(aurelia).getByText('Takes the lead')).toBeInTheDocument()
    expect(within(aurelia).getByText('Need this one.')).toBeInTheDocument()

    const kestrel = screen.getByRole('listitem', { name: 'Kestrel' })
    expect(within(kestrel).getByText('Prompt v1')).toBeInTheDocument()
    expect(within(kestrel).getByText('Nothing won yet')).toBeInTheDocument()
    expect(within(kestrel).getByText('Over budget')).toBeInTheDocument()
    expect(within(kestrel).getByRole('button', { name: 'Stop following Kestrel' })).toHaveTextContent('Following')

    await userEvent.click(within(aurelia).getByRole('button', { name: 'Follow Aurelia' }))
    expect(onFollow).toHaveBeenCalledWith('p1')
  })

  it('says the agents are thinking before the first call, or that nothing was said', () => {
    const { roster } = liveSession()
    const { rerender } = render(<AgentSeats roster={roster} startBudget={1000} calls={new Map()} leaderRef={null} waiting />)
    expect(screen.getAllByText('Thinking about the first call')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /Follow/ })).not.toBeInTheDocument()
    rerender(<AgentSeats roster={roster} startBudget={1000} calls={new Map()} leaderRef={null} />)
    expect(screen.getAllByText('No calls on this lot')).toHaveLength(2)
  })

  it('falls back to the starting budget and matches calls by name', () => {
    const session = liveSession()
    session.roster[1] = { ...session.roster[1], budget: null, version: null }
    render(
      <AgentSeats
        roster={session.roster}
        startBudget={1000}
        leaderRef={null}
        calls={latestCalls([bid({ player_ref: null, player_id: 'Kestrel', outcome: 'pass', bid: 0 })])}
      />,
    )
    expect(screen.getByRole('listitem', { name: 'Kestrel' })).toHaveTextContent('Agent')
    const kestrel = screen.getByRole('listitem', { name: 'Kestrel' })
    expect(within(kestrel).getByText('1000')).toBeInTheDocument()
    expect(within(kestrel).getByText('Passes')).toBeInTheDocument()
  })
})

describe('RoomTranscript', () => {
  it('lists rounds newest first with every call, reason and response time', () => {
    render(
      <RoomTranscript
        lotNumber={2}
        maxRounds={2}
        bids={[
          bid({ round: 1, outcome: 'outbid', response_ms: 2500 }),
          bid({ round: 2, won: true, bid: 50, reason: 'Mine.', response_ms: 900 }),
          bid({ round: 2, player_id: 'Kestrel', player_ref: 'p2', outcome: 'no_answer', bid: null, reason: null, response_ms: null }),
        ]}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Lot 2, round by round' })).toBeInTheDocument()
    expect(screen.getByText('3 calls')).toBeInTheDocument()
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(headings).toEqual(['Round 2, final', 'Round 1'])
    expect(screen.getByText('Wins the lot')).toBeInTheDocument()
    expect(screen.getByText('Mine.')).toBeInTheDocument()
    expect(screen.getByText('No answer')).toBeInTheDocument()
    expect(screen.getByText('2.5 s')).toBeInTheDocument()
  })

  it('highlights the followed agent, by ref or by name', () => {
    render(
      <RoomTranscript
        lotNumber={1}
        maxRounds={5}
        followedKey="p2"
        bids={[bid(), bid({ player_id: 'Kestrel', player_ref: 'p2', outcome: 'pass' }), bid({ player_id: 'p2', player_ref: null, round: 2 })]}
      />,
    )
    expect(document.querySelectorAll('[data-followed]')).toHaveLength(2)
  })

  it('explains an empty lot', () => {
    render(<RoomTranscript lotNumber={1} maxRounds={5} bids={[]} />)
    expect(screen.getByText('No calls yet. Each round, every agent answers at once.')).toBeInTheDocument()
  })
})

describe('LotBoard', () => {
  it('shows sold, unsold, current and upcoming lots', () => {
    render(
      <LotBoard
        currentNumber={3}
        lots={[
          lot({ number: 1, status: 'sold', sold_to_name: 'Kestrel', price: 40 }),
          lot({ number: 2, status: 'unsold', required: false }),
          lot({ number: 3 }),
          lot({ number: 4 }),
        ]}
      />,
    )
    expect(screen.getByText('2 of 4 settled')).toBeInTheDocument()
    expect(screen.getByText('Kestrel')).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument()
    expect(screen.getByText('Unsold')).toBeInTheDocument()
    expect(screen.getByText('Quality 9, not required')).toBeInTheDocument()
    expect(screen.getByText('On the block').closest('li')).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText('Upcoming')).toBeInTheDocument()
  })

  it('lets the viewer pick a closed or live lot by click or keyboard', async () => {
    const onSelect = vi.fn()
    render(
      <LotBoard
        currentNumber={2}
        selectedNumber={1}
        onSelect={onSelect}
        lots={[lot({ number: 1, status: 'sold', sold_to_name: 'Kestrel', price: 40 }), lot({ number: 2 }), lot({ number: 3 })]}
      />,
    )
    const rows = screen.getAllByRole('button')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(rows[0])
    expect(onSelect).toHaveBeenCalledWith(1)
    rows[1].focus()
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith(2)
    await userEvent.keyboard(' ')
    expect(onSelect).toHaveBeenCalledTimes(3)
  })
})

describe('WinnerStage', () => {
  it('crowns the winner with their figures', () => {
    render(<WinnerStage session={liveSession({ status: 'completed', auction: null })} />)
    expect(screen.getByRole('heading', { name: 'Aurelia wins' })).toBeInTheDocument()
    expect(screen.getByText('Auction closed, 1 of 3 lots sold')).toBeInTheDocument()
    expect(screen.getByText('of 2')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Runners-up' })).getByText('Kestrel')).toBeInTheDocument()
  })

  it('shares the win on a tie and copes with no standings', () => {
    const tied = liveSession({
      status: 'completed',
      standings: [
        { rank: 1, player_ref: 'p1', name: 'Aurelia', unique_required: 1, quality: 5, budget: 900 },
        { rank: 1, player_ref: 'p2', name: 'Kestrel', unique_required: 1, quality: 5, budget: 900 },
        { rank: 1, player_ref: 'p3', name: 'Morrow', unique_required: 1, quality: 5, budget: 900 },
      ],
    })
    const { rerender } = render(<WinnerStage session={tied} />)
    expect(screen.getByRole('heading', { name: 'Aurelia, Kestrel and Morrow share the win' })).toBeInTheDocument()
    rerender(<WinnerStage session={liveSession({ status: 'completed', standings: [] })} />)
    expect(screen.getByRole('heading', { name: 'No winner' })).toBeInTheDocument()
  })
})
