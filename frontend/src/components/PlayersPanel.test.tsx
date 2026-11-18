import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PlayersPanel } from './PlayersPanel'
import * as hooks from '../api/hooks'
import type { Player } from '../types'

vi.mock('../api/hooks', () => ({
  apiErrorMessage: vi.fn(() => 'boom'),
  usePlayers: vi.fn(),
  useDeletePlayer: vi.fn(),
}))
vi.mock('./PlayerDialog', () => ({
  PlayerDialog: ({ open, player }: { open: boolean; player: Player | null }) =>
    open ? <div>dialog:{player ? player.name : 'new'}</div> : null,
}))
vi.mock('./PlayerHistoryDialog', () => ({
  PlayerHistoryDialog: ({ playerId }: { playerId: string | null }) =>
    playerId ? <div>history:{playerId}</div> : null,
}))

const withPrompt: Player = {
  id: 'p1', name: 'ada', email: null, pending_versions: 0, created_at: null,
  current_version: {
    id: 'v', version: 3, prompt_text: 'bid low', status: 'accepted', source: 'admin',
    player_name: 'ada', identity_warning: null, email: null, created_at: null,
  },
}
const bare: Player = { ...withPrompt, id: 'p2', name: 'bob', current_version: null }

const mutate = vi.fn()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPlayers = (r: Record<string, unknown>) => vi.mocked(hooks.usePlayers).mockReturnValue(r as any)

beforeEach(() => {
  vi.clearAllMocks()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(hooks.useDeletePlayer).mockReturnValue({ mutate, isError: false } as any)
})
afterEach(() => vi.restoreAllMocks())

describe('PlayersPanel', () => {
  it('shows the empty state', () => {
    mockPlayers({ data: [] })
    render(<PlayersPanel />)
    expect(screen.getByText('No players yet. Add one, or connect the entry form.')).toBeInTheDocument()
    expect(screen.getByText('0 players')).toBeInTheDocument()
  })

  it('shows nothing while loading', () => {
    mockPlayers({ isLoading: true })
    render(<PlayersPanel />)
    expect(screen.queryByText(/No players yet/)).not.toBeInTheDocument()
  })

  it('shows a load error', () => {
    mockPlayers({ isError: true, error: new Error('x') })
    render(<PlayersPanel />)
    expect(screen.getByText('boom')).toBeInTheDocument()
  })

  it('lists players with prompt or placeholder', () => {
    mockPlayers({ data: [withPrompt, bare] })
    render(<PlayersPanel />)
    expect(screen.getByText('2 players')).toBeInTheDocument()
    expect(screen.getByText('v3')).toBeInTheDocument()
    expect(screen.getByText('bid low')).toBeInTheDocument()
    expect(screen.getByText('No accepted prompt yet')).toBeInTheDocument()
  })

  it('opens add, edit and history', async () => {
    mockPlayers({ data: [withPrompt] })
    render(<PlayersPanel />)
    await userEvent.click(screen.getByRole('button', { name: 'Add player' }))
    expect(screen.getByText('dialog:new')).toBeInTheDocument()
    await userEvent.click(within(screen.getByRole('listitem')).getByRole('button', { name: 'Edit' }))
    expect(screen.getByText('dialog:ada')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.getByText('history:p1')).toBeInTheDocument()
  })

  it('deletes only after confirmation', async () => {
    mockPlayers({ data: [withPrompt] })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<PlayersPanel />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(confirm).toHaveBeenCalledWith('Delete ada and all prompt versions?')
    expect(mutate).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(mutate).toHaveBeenCalledWith('p1')
  })

  it('shows a delete error', () => {
    mockPlayers({ data: [] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(hooks.useDeletePlayer).mockReturnValue({ mutate, isError: true, error: new Error('x') } as any)
    render(<PlayersPanel />)
    expect(screen.getByText('boom')).toBeInTheDocument()
  })
})
