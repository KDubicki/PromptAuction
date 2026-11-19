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

function setup(startState = {}, removeState = {}) {
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
})
