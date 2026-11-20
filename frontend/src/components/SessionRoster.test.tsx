import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SessionRoster } from './SessionRoster'
import * as hooks from '../api/hooks'
import type { GameSession } from '../types'

vi.mock('../api/hooks', () => ({
  apiErrorMessage: vi.fn((e: unknown) => `msg:${(e as Error).message}`),
  useStartGameSession: vi.fn(),
  useUpdateSessionSettings: vi.fn(),
  useUpdateSessionStatus: vi.fn(),
  useRemoveFromRoster: vi.fn(),
  useAddToRoster: vi.fn(),
  usePlayers: vi.fn(),
}))

const pending: GameSession = {
  id: 's1',
  name: 'Evening',
  status: 'pending',
  roster: [
    { player_ref: 'p1', name: 'Aurelia', current_version: 3, version_id: null, version: null, prompt_text: null, budget: null, items: [] },
    { player_ref: 'p2', name: 'Bram', current_version: null, version_id: null, version: null, prompt_text: null, budget: null, items: [] },
  ],
  start_blockers: [],
  settings: { budget: 100, lots_count: 5, max_rounds: 10 },
  required_items: [],
  lots: [],
  auction: null,
  standings: [],
  pause_reason: null,
  current_round: 0,
  current_iteration: 0,
  started_at: null,
}

const start = vi.fn()
const remove = vi.fn()
const saveSettings = vi.fn()
const updateStatus = vi.fn()

function setup(startState = {}, removeState = {}, settingsState = {}, statusState = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(hooks.useUpdateSessionStatus).mockReturnValue({ mutate: updateStatus, isPending: false, isError: false, ...statusState } as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(hooks.useUpdateSessionSettings).mockReturnValue({ mutate: saveSettings, isPending: false, isError: false, ...settingsState } as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(hooks.useStartGameSession).mockReturnValue({ mutate: start, isPending: false, isError: false, ...startState } as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(hooks.useRemoveFromRoster).mockReturnValue({ mutate: remove, isPending: false, isError: false, ...removeState } as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(hooks.useAddToRoster).mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false } as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(hooks.usePlayers).mockReturnValue({ data: [] } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  setup()
})

describe('SessionRoster', () => {
  it('shows current versions and missing prompts for a pending session', () => {
    render(<SessionRoster session={pending} />)
    expect(screen.getByText('Evening')).toBeInTheDocument()
    expect(screen.getByText('2 players')).toBeInTheDocument()
    expect(screen.getByText('Current v3')).toBeInTheDocument()
    expect(screen.getByText('No accepted prompt yet')).toBeInTheDocument()
  })

  it('uses the singular for one player', () => {
    render(<SessionRoster session={{ ...pending, roster: pending.roster.slice(0, 1) }} />)
    expect(screen.getByText('1 player')).toBeInTheDocument()
  })

  it('starts the session', async () => {
    render(<SessionRoster session={pending} />)
    await userEvent.click(screen.getByRole('button', { name: 'Start session' }))
    expect(start).toHaveBeenCalledWith('s1')
  })

  it('disables Start and lists blockers', () => {
    render(<SessionRoster session={{ ...pending, start_blockers: ['Bram has no accepted prompt'] }} />)
    expect(screen.getByRole('button', { name: 'Start session' })).toBeDisabled()
    expect(screen.getByText('Bram has no accepted prompt')).toBeInTheDocument()
  })

  it('removes a player with a named button', async () => {
    render(<SessionRoster session={pending} />)
    await userEvent.click(screen.getByRole('button', { name: 'Remove Aurelia' }))
    expect(remove).toHaveBeenCalledWith({ sessionId: 's1', playerId: 'p1' })
  })

  it('opens the add players dialog', async () => {
    render(<SessionRoster session={pending} />)
    await userEvent.click(screen.getByRole('button', { name: 'Add players' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('hides actions and shows pinned versions after start', () => {
    const started: GameSession = {
      ...pending,
      status: 'running',
      roster: [{ player_ref: 'p1', name: 'Aurelia', current_version: 3, version_id: 'v', version: 2, prompt_text: 'x', budget: null, items: [] }],
    }
    render(<SessionRoster session={started} />)
    expect(screen.getByText('Plays v2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start session' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add players' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
  })

  it('shows start and remove errors', () => {
    setup({ isError: true, error: new Error('conflict') }, { isError: true, error: new Error('nope') })
    render(<SessionRoster session={pending} />)
    expect(screen.getByText('msg:conflict')).toBeInTheDocument()
    expect(screen.getByText('msg:nope')).toBeInTheDocument()
  })

  it('shows an empty roster hint', () => {
    render(<SessionRoster session={{ ...pending, roster: [] }} />)
    expect(screen.getByText(/No players in this session/)).toBeInTheDocument()
  })

  it('clears mutation errors and the dialog when the session changes', async () => {
    vi.mocked(hooks.useStartGameSession).mockImplementation(() => {
      const [error] = useState(new Error('conflict'))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { mutate: start, isPending: false, isError: true, error } as any
    })
    const { rerender } = render(<SessionRoster session={pending} />)
    expect(screen.getByText('msg:conflict')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add players' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    vi.mocked(hooks.useStartGameSession).mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { mutate: start, isPending: false, isError: false } as any
    })
    rerender(<SessionRoster session={{ ...pending, id: 's2', name: 'Other' }} />)
    expect(screen.queryByText('msg:conflict')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('drops the add dialog when the session is no longer pending', async () => {
    const { rerender } = render(<SessionRoster session={pending} />)
    await userEvent.click(screen.getByRole('button', { name: 'Add players' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    rerender(<SessionRoster session={{ ...pending, status: 'running' }} />)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('disables Remove while a remove is pending', () => {
    setup({}, { isPending: true })
    render(<SessionRoster session={pending} />)
    expect(screen.getByRole('button', { name: 'Remove Aurelia' })).toBeDisabled()
  })

  describe('session controls', () => {
    const running: GameSession = {
      ...pending,
      status: 'running',
      auction: { lot_number: 1, current_round: 2, highest_bid: 10, leader_ref: 'p1', leader_name: 'Aurelia' },
      lots: [{ number: 1, item: 'Vase', quality: 3, required: true, status: 'pending' }],
    } as unknown as GameSession

    it('offers Pause and Complete while running', async () => {
      render(<SessionRoster session={running} />)
      expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Pause' }))
      expect(updateStatus).toHaveBeenCalledWith({ sessionId: 's1', status: 'paused' })
    })

    it('offers Resume and Complete while paused', async () => {
      render(<SessionRoster session={{ ...running, status: 'paused' }} />)
      expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Resume' }))
      expect(updateStatus).toHaveBeenCalledWith({ sessionId: 's1', status: 'running' })
      expect(screen.getByRole('button', { name: 'Complete' })).toBeInTheDocument()
    })

    it('completes after confirmation', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<SessionRoster session={running} />)
      await userEvent.click(screen.getByRole('button', { name: 'Complete' }))
      expect(confirm).toHaveBeenCalledWith('End this session now? Unsold lots stay unsold.')
      expect(updateStatus).toHaveBeenCalledWith({ sessionId: 's1', status: 'completed' })
      confirm.mockRestore()
    })

    it('does nothing when the confirmation is cancelled', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<SessionRoster session={running} />)
      await userEvent.click(screen.getByRole('button', { name: 'Complete' }))
      expect(updateStatus).not.toHaveBeenCalled()
      confirm.mockRestore()
    })

    it('has no controls for pending or completed sessions', () => {
      const { rerender } = render(<SessionRoster session={pending} />)
      for (const name of ['Pause', 'Resume', 'Complete']) {
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
      }
      rerender(<SessionRoster session={{ ...running, status: 'completed' }} />)
      for (const name of ['Pause', 'Resume', 'Complete']) {
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
      }
    })

    it('disables the controls while updating and shows an error', () => {
      setup({}, {}, {}, { isPending: true, isError: true, error: new Error('refused') })
      render(<SessionRoster session={running} />)
      expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Complete' })).toBeDisabled()
      expect(screen.getByText('msg:refused')).toBeInTheDocument()
    })

    it('shows the auction status only while running or paused', () => {
      const { rerender } = render(<SessionRoster session={running} />)
      expect(screen.getByText('Highest bid 10 · Aurelia')).toBeInTheDocument()
      rerender(<SessionRoster session={{ ...running, status: 'paused' }} />)
      expect(screen.getByText('Highest bid 10 · Aurelia')).toBeInTheDocument()
      rerender(<SessionRoster session={{ ...running, status: 'completed' }} />)
      expect(screen.queryByText('Highest bid 10 · Aurelia')).not.toBeInTheDocument()
      expect(screen.getByText('Auction finished')).toBeInTheDocument()
    })
  })

  describe('settings while pending', () => {
    it('shows the settings and saves edits', async () => {
      render(<SessionRoster session={pending} />)
      expect(screen.getByLabelText('Budget')).toHaveValue(100)
      expect(screen.getByLabelText('Items')).toHaveValue(5)
      expect(screen.getByLabelText('Rounds per item')).toHaveValue(10)
      const save = screen.getByRole('button', { name: 'Save settings' })
      expect(save).toBeDisabled()
      await userEvent.clear(screen.getByLabelText('Budget'))
      await userEvent.type(screen.getByLabelText('Budget'), '250')
      await userEvent.click(save)
      expect(saveSettings).toHaveBeenCalledWith({
        sessionId: 's1',
        settings: { budget: 250, lots_count: 5, max_rounds: 10 },
      })
    })

    it('blocks Start while the draft is dirty and Discard re-enables it', async () => {
      render(<SessionRoster session={pending} />)
      const startButton = screen.getByRole('button', { name: 'Start session' })
      expect(startButton).toBeEnabled()
      expect(screen.queryByText('Save or discard your settings changes before starting.')).not.toBeInTheDocument()
      await userEvent.clear(screen.getByLabelText('Budget'))
      await userEvent.type(screen.getByLabelText('Budget'), '250')
      expect(startButton).toBeDisabled()
      expect(screen.getByText('Save or discard your settings changes before starting.')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
      expect(screen.getByLabelText('Budget')).toHaveValue(100)
      expect(startButton).toBeEnabled()
    })

    it('blocks Start for an invalid draft too', async () => {
      render(<SessionRoster session={pending} />)
      await userEvent.clear(screen.getByLabelText('Items'))
      expect(screen.getByRole('button', { name: 'Start session' })).toBeDisabled()
      expect(screen.getByText('1–500')).toBeInTheDocument()
    })

    it('allows Start once the saved settings come back', async () => {
      const { rerender } = render(<SessionRoster session={pending} />)
      await userEvent.clear(screen.getByLabelText('Budget'))
      await userEvent.type(screen.getByLabelText('Budget'), '250')
      await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
      expect(screen.getByRole('button', { name: 'Start session' })).toBeDisabled()
      rerender(<SessionRoster session={{ ...pending, settings: { ...pending.settings, budget: 250 } }} />)
      await userEvent.click(screen.getByRole('button', { name: 'Start session' }))
      expect(start).toHaveBeenCalledWith('s1')
    })

    it('disables Start while settings are saving', () => {
      setup({}, {}, { isPending: true })
      render(<SessionRoster session={pending} />)
      expect(screen.getByRole('button', { name: 'Start session' })).toBeDisabled()
    })

    it('blocks saving out-of-range values', async () => {
      render(<SessionRoster session={pending} />)
      await userEvent.clear(screen.getByLabelText('Items'))
      await userEvent.type(screen.getByLabelText('Items'), '501')
      expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled()
    })

    it('disables fields and save while saving, and shows a save error', async () => {
      setup({}, {}, { isPending: true, isError: true, error: new Error('late') })
      render(<SessionRoster session={pending} />)
      expect(screen.getByLabelText('Budget')).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled()
      expect(screen.getByText('msg:late')).toBeInTheDocument()
    })
  })

  describe('auction status', () => {
    const lot = { number: 2, item: 'Amber Idol', quality: 7, required: true, status: 'pending' as const, sold_to: null, sold_to_name: null, price: null, sold_in_round: null }
    const running: GameSession = {
      ...pending,
      status: 'running',
      settings: { budget: 100, lots_count: 5, max_rounds: 10 },
      lots: [{ ...lot, number: 1, item: 'Old', status: 'sold' }, lot],
      auction: { lot_number: 2, current_round: 3, highest_bid: 40, leader_ref: 'p1', leader_name: 'Aurelia', void_rounds: 0 },
      roster: [
        {
          player_ref: 'p1', name: 'Aurelia', current_version: 1, version_id: 'v', version: 1, prompt_text: 'x', budget: 60,
          items: [
            { item: 'Amber Idol', quality: 7, required: true, lot_number: 1, price: 40 },
            { item: 'Amber Idol', quality: 5, required: true, lot_number: 3, price: 10 },
            { item: 'Jade Fan', quality: 4, required: true, lot_number: 4, price: 20 },
            { item: 'Dull Rock', quality: 1, required: false, lot_number: 5, price: 1 },
          ],
        },
      ],
    }

    it('shows lot, round and highest bid lines', () => {
      render(<SessionRoster session={running} />)
      expect(screen.getByText('Lot 2 of 5 · Amber Idol · quality 7 · required')).toBeInTheDocument()
      expect(screen.getByText('Round 3 of 10')).toBeInTheDocument()
      expect(screen.getByText('Highest bid 40 · Aurelia')).toBeInTheDocument()
      expect(screen.queryByLabelText('Budget')).not.toBeInTheDocument()
    })

    it('says when a lot is not required and nobody has bid', () => {
      render(
        <SessionRoster
          session={{
            ...running,
            lots: [{ ...lot, required: false }],
            auction: { ...running.auction!, highest_bid: 0, leader_name: null, leader_ref: null },
          }}
        />,
      )
      expect(screen.getByText('Lot 2 of 5 · Amber Idol · quality 7 · not required')).toBeInTheDocument()
      expect(screen.getByText('No bids yet')).toBeInTheDocument()
    })

    it('shows budget and distinct required items on roster rows', () => {
      render(<SessionRoster session={running} />)
      expect(screen.getByText('60 pts')).toBeInTheDocument()
      expect(screen.getByText('2 required items')).toBeInTheDocument()
    })

    it('uses the singular for one required item', () => {
      const one = { ...running, roster: [{ ...running.roster[0], items: running.roster[0].items.slice(0, 2) }] }
      render(<SessionRoster session={one} />)
      expect(screen.getByText('1 required item')).toBeInTheDocument()
    })

    it('shows the pause reason in a warning', () => {
      render(<SessionRoster session={{ ...running, status: 'paused', pause_reason: 'Model unavailable' }} />)
      expect(screen.getByRole('alert')).toHaveTextContent('Model unavailable')
    })

    it('omits status lines when there is no auction and no budget', () => {
      render(<SessionRoster session={{ ...running, status: 'completed', auction: null, roster: [{ ...running.roster[0], budget: null }] }} />)
      expect(screen.queryByText(/^Lot /)).not.toBeInTheDocument()
      expect(screen.queryByText(/pts/)).not.toBeInTheDocument()
    })
  })
})
