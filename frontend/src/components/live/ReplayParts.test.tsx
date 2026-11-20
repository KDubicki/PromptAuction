import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AgentDiary } from './AgentDiary'
import { LotStrip } from './LotStrip'
import { ReplayStage } from './ReplayStage'
import { agentDiary, roundStates } from '../../replay'
import { bid, liveSession, lot } from '../../test/liveFixtures'

const lots = [
  lot({ number: 1, status: 'sold', sold_to: 'p2', sold_to_name: 'Kestrel', price: 40 }),
  lot({ number: 2, status: 'unsold', required: false }),
  lot({ number: 3 }),
  lot({ number: 4 }),
]

describe('LotStrip', () => {
  it('shows each lot and steps through the reachable ones', async () => {
    const onSelect = vi.fn()
    const onLive = vi.fn()
    render(<LotStrip lots={lots} selected={1} liveNumber={3} followedRef="p2" onSelect={onSelect} onLive={onLive} />)

    expect(screen.getByRole('button', { name: 'Lot 1, Unicorn Horn, quality 9, required, sold to Kestrel for 40' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Lot 2.*unsold/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Lot 3.*on the block now/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Lot 4.*upcoming/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous lot' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Next lot' }))
    expect(onSelect).toHaveBeenLastCalledWith(2)
    await userEvent.click(screen.getByRole('button', { name: /Lot 3/ }))
    expect(onSelect).toHaveBeenLastCalledWith(3)
    await userEvent.click(screen.getByRole('button', { name: 'Back to live' }))
    expect(onLive).toHaveBeenCalled()

    screen.getByRole('button', { name: /Lot 1,/ }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onSelect).toHaveBeenLastCalledWith(2)
    onSelect.mockClear()
    await userEvent.keyboard('{ArrowLeft}')
    expect(onSelect).not.toHaveBeenCalled()
    await userEvent.keyboard('a')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('stops at the last reachable lot and hides Back to live when on it', async () => {
    const onSelect = vi.fn()
    render(<LotStrip lots={lots} selected={3} liveNumber={3} followedRef={null} onSelect={onSelect} onLive={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Back to live' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next lot' })).toBeDisabled()
    screen.getByRole('button', { name: /Lot 3/ }).focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(onSelect).toHaveBeenCalledWith(2)
  })
})

const lotBids = [
  bid({ round: 1, bid: 10, outcome: 'leading' }),
  bid({ round: 2, player_id: 'Kestrel', player_ref: 'p2', bid: 40, outcome: 'leading', won: true }),
  bid({ round: 3, bid: 0, outcome: 'pass' }),
]

describe('ReplayStage', () => {
  const sold = lot({ number: 1, status: 'sold', sold_to_name: 'Kestrel', price: 40, sold_in_round: 3 })

  it('replays the price round by round and lets the viewer scrub', async () => {
    const onRound = vi.fn()
    const onTogglePlay = vi.fn()
    const { rerender } = render(
      <ReplayStage lot={sold} lotsCount={4} states={roundStates(lotBids)} round={1} playing={false} onRound={onRound} onTogglePlay={onTogglePlay} />,
    )
    expect(screen.getByRole('heading', { name: 'Unicorn Horn' })).toBeInTheDocument()
    expect(screen.getByText('Replay, lot 1 of 4')).toBeInTheDocument()
    expect(screen.getByLabelText('Highest bid 10')).toBeInTheDocument()
    expect(screen.getByText('Aurelia')).toBeInTheDocument()
    expect(screen.getByText('Round 1 of 3')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Round 3' })).toBeInTheDocument()

    const chart = screen.getByRole('group', { name: 'Price by round' })
    await userEvent.click(within(chart).getByRole('button', { name: 'Round 2' }))
    expect(onRound).toHaveBeenCalledWith(2)
    await userEvent.click(screen.getByRole('button', { name: 'Play replay' }))
    expect(onTogglePlay).toHaveBeenCalled()

    rerender(<ReplayStage lot={sold} lotsCount={4} states={roundStates(lotBids)} round={3} playing onRound={onRound} onTogglePlay={onTogglePlay} />)
    expect(screen.getByRole('status')).toHaveTextContent('Sold to Kestrel for 40 in round 3')
    expect(screen.getByRole('button', { name: 'Pause replay' })).toHaveTextContent('Pause')
    expect(screen.getByRole('button', { name: 'Round 3: 40, Kestrel leads' })).toHaveAttribute('aria-pressed', 'true')

    rerender(<ReplayStage lot={sold} lotsCount={4} states={roundStates(lotBids)} round={3} playing={false} onRound={onRound} onTogglePlay={onTogglePlay} />)
    expect(screen.getByRole('button', { name: 'Play replay' })).toHaveTextContent('Replay lot')
  })

  it('shows an unsold lot with no rounds', () => {
    render(<ReplayStage lot={lots[1]} lotsCount={4} states={[]} round={0} playing={false} onRound={vi.fn()} onTogglePlay={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Unsold, nobody bid')
    expect(screen.getByText('No bids yet')).toBeInTheDocument()
    expect(screen.getByText('Not required, counts for nothing')).toBeInTheDocument()
  })

  it('labels a round where nobody had bid yet', () => {
    const states = roundStates([bid({ round: 1, outcome: 'pass', bid: 0 })])
    render(<ReplayStage lot={sold} lotsCount={4} states={states} round={1} playing={false} onRound={vi.fn()} onTogglePlay={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Round 1: no bids' })).toHaveAttribute('title', 'Round 1: no bids, nobody raised')
  })

  it('names a sale without a recorded round', () => {
    render(<ReplayStage lot={{ ...sold, sold_in_round: null }} lotsCount={4} states={[]} round={0} playing={false} onRound={vi.fn()} onTogglePlay={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent(/^Sold to Kestrel for 40$/)
  })
})

describe('AgentDiary', () => {
  const session = liveSession({
    lots: [
      lot({ number: 1, status: 'sold', sold_to: 'p1', sold_to_name: 'Aurelia', price: 40 }),
      lot({ number: 2, item: 'Golem Core', status: 'sold', sold_to: 'p2', sold_to_name: 'Kestrel', price: 90 }),
      lot({ number: 3, status: 'unsold', required: false }),
      lot({ number: 4, status: 'unsold' }),
      lot({ number: 5 }),
    ],
  })
  const bids = [
    bid({ lot_number: 1, round: 1, bid: 40, outcome: 'leading', won: true, reason: 'Mine now.' }),
    bid({ lot_number: 2, round: 1, bid: 50, outcome: 'leading', reason: null }),
    bid({ lot_number: 2, round: 2, bid: 60, outcome: 'not_higher', reason: 'Too late.' }),
    bid({ lot_number: 3, round: 1, bid: 0, outcome: 'pass', reason: null }),
    bid({ lot_number: 4, round: 1, bid: 20, outcome: 'outbid', reason: null }),
    bid({ lot_number: 5, round: 1, bid: null, outcome: 'no_answer', reason: null, response_ms: null }),
  ]

  it("lists the agent's lots with calls, outcome and summary, and jumps to a lot", async () => {
    const onWatch = vi.fn()
    render(<AgentDiary name="Aurelia" entries={agentDiary(session, bids, session.roster[0])} selectedLot={2} onWatch={onWatch} />)

    expect(screen.getByRole('heading', { name: 'Aurelia, lot by lot' })).toBeInTheDocument()
    expect(screen.getByText('Bought for 40')).toBeInTheDocument()
    expect(screen.getByText('Lost to Kestrel at 90')).toBeInTheDocument()
    expect(screen.getByText('Stayed out')).toBeInTheDocument()
    expect(screen.getByText('Top bid 20, unsold')).toBeInTheDocument()
    expect(screen.getByText('On the block')).toBeInTheDocument()
    expect(screen.getAllByText('Too late.').length).toBeGreaterThan(0)
    expect(screen.getByTitle('Round 2: Bids 60, too low')).toHaveTextContent('60')
    expect(screen.getByTitle('Round 1: Passes')).toHaveTextContent('pass')
    expect(screen.getByTitle('Round 1: No answer')).toHaveTextContent('–')

    await userEvent.click(screen.getByRole('button', { name: 'Watch lot 2' }))
    expect(onWatch).toHaveBeenCalledWith(2)
  })

  it('handles an agent with no calls and no closed lots', () => {
    const fresh = liveSession({ lots: [lot({ number: 1, status: 'sold', sold_to: 'p2', sold_to_name: 'Kestrel', price: 5 })] })
    const { rerender } = render(<AgentDiary name="Aurelia" entries={agentDiary(fresh, [], fresh.roster[0])} selectedLot={1} onWatch={vi.fn()} />)
    expect(screen.getByText('No calls')).toBeInTheDocument()
    rerender(<AgentDiary name="Aurelia" entries={[]} selectedLot={1} onWatch={vi.fn()} />)
    expect(screen.getByText('No lots have closed yet.')).toBeInTheDocument()
  })
})
