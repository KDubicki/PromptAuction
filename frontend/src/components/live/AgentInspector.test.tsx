import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AgentInspector } from './AgentInspector'
import { bid, liveSession, lot } from '../../test/liveFixtures'
import type { SessionBid } from '../../types'

const session = liveSession({
  lots: [lot({ number: 1, status: 'sold', sold_to: 'p2', sold_to_name: 'Kestrel', price: 40 }), lot({ number: 2, item: 'Golem Core' })],
})
session.roster[0] = { ...session.roster[0], prompt_text: 'Only Golem Core matters.' }

const calls: SessionBid[] = [
  bid({ lot_number: 1, round: 1, bid: 10, outcome: 'leading', reason: 'Opening.', raw_response: '{"bid": 10, "reason": "Opening."}', failure: null }),
  bid({ lot_number: 1, round: 1, player_id: 'Kestrel', player_ref: 'p2', bid: 40, outcome: 'leading', won: true }),
  bid({ lot_number: 1, round: 2, bid: null, outcome: 'no_answer', reason: null, raw_response: 'I think 50', failure: 'unreadable' }),
  bid({ lot_number: 2, round: 1, bid: null, outcome: 'no_answer', reason: null, response_ms: null, raw_response: null, failure: 'no_reply' }),
  bid({ lot_number: 2, round: 2, bid: 0, outcome: 'pass', reason: null }),
]

function renderAt(call: SessionBid | null, onNavigate = vi.fn(), onClose = vi.fn()) {
  return render(<AgentInspector session={session} bids={calls} call={call} onClose={onClose} onNavigate={onNavigate} />)
}

describe('AgentInspector', () => {
  it('stays closed without a call', () => {
    renderAt(null)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows what the agent saw, what it was told and what it replied', async () => {
    renderAt(calls[0])
    const drawer = screen.getByRole('dialog')
    expect(within(drawer).getByRole('heading', { name: 'Aurelia' })).toBeInTheDocument()
    expect(within(drawer).getByText('Lot 1, round 1, prompt v2')).toBeInTheDocument()
    expect(within(drawer).getByText('Takes the lead')).toBeInTheDocument()
    expect(within(drawer).getByText(/^Counted\. 10 beat the highest bid of 0/)).toBeInTheDocument()
    expect(within(drawer).getByText('Opening.')).toBeInTheDocument()
    expect(within(drawer).getByText('Answered in 1.2 s')).toBeInTheDocument()
    expect(within(drawer).getByText('Nobody had bid yet')).toBeInTheDocument()
    expect(within(drawer).getByText('Did not own Unicorn Horn yet')).toBeInTheDocument()
    expect(within(drawer).getByTitle('Unicorn Horn: missing')).toBeInTheDocument()
    expect(within(drawer).getByText('Only Golem Core matters.')).toBeInTheDocument()
    expect(within(drawer).getByText('1 of 4')).toBeInTheDocument()

    const message = within(drawer).getByRole('button', { name: 'Exact message it received' })
    await userEvent.click(message)
    expect(message).toHaveAttribute('aria-expanded', 'true')
    expect(within(drawer).getByText(/"you": "Aurelia"/)).toBeInTheDocument()
    await userEvent.click(within(drawer).getByRole('button', { name: 'Its raw reply' }))
    expect(within(drawer).getByText('{"bid": 10, "reason": "Opening."}')).toBeInTheDocument()
    await userEvent.click(message)
    expect(message).toHaveAttribute('aria-expanded', 'false')
  })

  it('steps through the agent’s answers with buttons and arrow keys', async () => {
    const onNavigate = vi.fn()
    const { rerender } = renderAt(calls[2], onNavigate)
    expect(screen.getByText('Ignored. The reply had no readable JSON with a bid.')).toBeInTheDocument()
    expect(screen.getByText('It was leading')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Earlier answer' }))
    expect(onNavigate).toHaveBeenLastCalledWith(calls[0])
    await userEvent.click(screen.getByRole('button', { name: 'Later answer' }))
    expect(onNavigate).toHaveBeenLastCalledWith(calls[3])
    await userEvent.keyboard('{ArrowLeft}')
    expect(onNavigate).toHaveBeenLastCalledWith(calls[0])
    await userEvent.keyboard('{ArrowRight}')
    expect(onNavigate).toHaveBeenLastCalledWith(calls[3])

    rerender(<AgentInspector session={session} bids={calls} call={calls[0]} onClose={vi.fn()} onNavigate={onNavigate} />)
    expect(screen.getByRole('button', { name: 'Earlier answer' })).toBeDisabled()
    onNavigate.mockClear()
    await userEvent.keyboard('{ArrowLeft}')
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('explains a missing reply, an old round without a recorded reply, and closes', async () => {
    const onClose = vi.fn()
    const { rerender } = renderAt(calls[3], vi.fn(), onClose)
    expect(screen.getByText('The model returned an error, so there was no reply.')).toBeInTheDocument()
    expect(screen.getByText('There was no reply text to show.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Later answer' })).toBeEnabled()

    rerender(<AgentInspector session={session} bids={calls} call={calls[4]} onClose={onClose} onNavigate={vi.fn()} />)
    expect(screen.getByText('Raw replies are recorded for rounds played from now on.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Later answer' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows a rival-held price, an owned copy and a missing prompt', () => {
    const owned = liveSession({
      lots: [lot({ number: 1, status: 'sold', sold_to: 'p1', sold_to_name: 'Aurelia', price: 40 }), lot({ number: 2, item: 'Unicorn Horn' })],
    })
    owned.roster[0] = {
      ...owned.roster[0],
      version: null,
      prompt_text: null,
      items: [{ item: 'Unicorn Horn', quality: 9, required: true, lot_number: 1, price: 40 }],
    }
    const bids = [
      bid({ lot_number: 2, round: 1, player_ref: 'p2', player_id: 'Kestrel', bid: 30, outcome: 'leading' }),
      bid({ lot_number: 2, round: 2, bid: 0, outcome: 'pass', response_ms: null, reason: null }),
    ]
    render(<AgentInspector session={owned} bids={bids} call={bids[1]} onClose={vi.fn()} onNavigate={vi.fn()} />)
    expect(screen.getByText('Lot 2, round 2')).toBeInTheDocument()
    expect(screen.getByText('Held by Kestrel')).toBeInTheDocument()
    expect(screen.getByText('Already owned Unicorn Horn at quality 9')).toBeInTheDocument()
    expect(screen.getByTitle('Unicorn Horn: owned')).toBeInTheDocument()
    expect(screen.getByText('No prompt text recorded for this session.')).toBeInTheDocument()
    expect(screen.queryByText(/^Answered in/)).not.toBeInTheDocument()
  })

  it('renders nothing inside when the call belongs to nobody in the roster', () => {
    render(<AgentInspector session={session} bids={calls} call={bid({ player_ref: 'ghost', player_id: 'Ghost' })} onClose={vi.fn()} onNavigate={vi.fn()} />)
    expect(screen.queryByText('What it saw')).not.toBeInTheDocument()
  })
})
