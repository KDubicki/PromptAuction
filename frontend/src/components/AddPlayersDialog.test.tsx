import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AddPlayersDialog } from './AddPlayersDialog'
import * as hooks from '../api/hooks'
import type { GameSession, Player } from '../types'

vi.mock('../api/hooks', () => ({
  apiErrorMessage: vi.fn((e: unknown) => `msg:${(e as Error).message}`),
  useAddToRoster: vi.fn(),
  usePlayers: vi.fn(),
}))

const mkPlayer = (id: string, name: string): Player => ({
  id, name, email: null, current_version: null, pending_versions: 0, latest_version: 0, created_at: null,
})

const session: GameSession = {
  id: 's1',
  name: 'Evening',
  status: 'pending',
  roster: [{ player_ref: 'p1', name: 'Aurelia', current_version: 1, version_id: null, version: null, prompt_text: null }],
  start_blockers: [],
  current_round: 0,
  current_iteration: 0,
  started_at: null,
}

const add = vi.fn()
const onClose = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  add.mockResolvedValue({})
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(hooks.useAddToRoster).mockReturnValue({ mutateAsync: add } as any)
  vi.mocked(hooks.usePlayers).mockReturnValue({
    data: [mkPlayer('p1', 'Aurelia'), mkPlayer('p2', 'Bram'), mkPlayer('p3', 'Cato')],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
})

async function open() {
  await userEvent.click(screen.getByRole('combobox'))
  return screen.getByRole('listbox')
}

describe('AddPlayersDialog', () => {
  it('excludes players already in the roster', async () => {
    render(<AddPlayersDialog session={session} open onClose={onClose} />)
    const list = await open()
    expect(within(list).queryByText('Aurelia')).not.toBeInTheDocument()
    expect(within(list).getByText('Bram')).toBeInTheDocument()
    expect(within(list).getByText('Cato')).toBeInTheDocument()
  })

  it('disables Add until something is chosen', () => {
    render(<AddPlayersDialog session={session} open onClose={onClose} />)
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })

  it('adds chosen players sequentially then closes', async () => {
    render(<AddPlayersDialog session={session} open onClose={onClose} />)
    let list = await open()
    await userEvent.click(within(list).getByText('Bram'))
    list = await open()
    await userEvent.click(within(list).getByText('Cato'))
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(add).toHaveBeenNthCalledWith(1, { sessionId: 's1', playerId: 'p2' })
    expect(add).toHaveBeenNthCalledWith(2, { sessionId: 's1', playerId: 'p3' })
  })

  it('shows the error and stays open when an add fails', async () => {
    add.mockRejectedValue(new Error('409'))
    render(<AddPlayersDialog session={session} open onClose={onClose} />)
    const list = await open()
    await userEvent.click(within(list).getByText('Bram'))
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('msg:409')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('cancels', async () => {
    render(<AddPlayersDialog session={session} open onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('handles players not loaded yet', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(hooks.usePlayers).mockReturnValue({ data: undefined } as any)
    render(<AddPlayersDialog session={session} open onClose={onClose} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('retries only the players not yet added after a partial failure', async () => {
    add.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('409'))
    vi.mocked(hooks.usePlayers).mockReturnValue({
      data: [mkPlayer('p2', 'Bram'), mkPlayer('p3', 'Cato'), mkPlayer('p4', 'Dara')],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    render(<AddPlayersDialog session={session} open onClose={onClose} />)
    for (const name of ['Bram', 'Cato', 'Dara']) {
      const list = await open()
      await userEvent.click(within(list).getByText(name))
    }
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('msg:409')).toBeInTheDocument()
    expect(add).toHaveBeenCalledTimes(2)

    add.mockClear()
    add.mockResolvedValue({})
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(add).toHaveBeenCalledTimes(2)
    expect(add).toHaveBeenNthCalledWith(1, { sessionId: 's1', playerId: 'p3' })
    expect(add).toHaveBeenNthCalledWith(2, { sessionId: 's1', playerId: 'p4' })
  })

  it('blocks Cancel while saving', async () => {
    let release: () => void = () => {}
    add.mockReturnValue(new Promise<void>((resolve) => { release = resolve }))
    render(<AddPlayersDialog session={session} open onClose={onClose} />)
    const list = await open()
    await userEvent.click(within(list).getByText('Bram'))
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    release()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
