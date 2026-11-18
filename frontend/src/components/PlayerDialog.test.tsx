import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PlayerDialog } from './PlayerDialog'
import * as hooks from '../api/hooks'
import type { Player } from '../types'

vi.mock('../api/hooks', () => ({
  apiErrorMessage: vi.fn((e: unknown) => `msg:${(e as Error).message}`),
  useCreatePlayer: vi.fn(),
  useUpdatePlayer: vi.fn(),
  useAddPromptVersion: vi.fn(),
}))

const player: Player = {
  id: 'p1',
  name: 'ada',
  email: 'ada@x.io',
  current_version: {
    id: 'v2', version: 2, prompt_text: 'old prompt', status: 'accepted', source: 'admin',
    player_name: 'ada', identity_warning: null, email: null, created_at: null,
  },
  pending_versions: 0,
  created_at: null,
}

const create = vi.fn()
const update = vi.fn()
const addVersion = vi.fn()
const onClose = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  create.mockResolvedValue({})
  update.mockResolvedValue({})
  addVersion.mockResolvedValue({})
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(hooks.useCreatePlayer).mockReturnValue({ mutateAsync: create } as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(hooks.useUpdatePlayer).mockReturnValue({ mutateAsync: update } as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(hooks.useAddPromptVersion).mockReturnValue({ mutateAsync: addVersion } as any)
})

describe('PlayerDialog', () => {
  it('creates a player with undefined email when blank', async () => {
    render(<PlayerDialog open player={null} onClose={onClose} />)
    const submit = screen.getByRole('button', { name: 'Add player' })
    expect(submit).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Nick'), ' grace ')
    await userEvent.type(screen.getByLabelText('Prompt'), 'bid low')
    await userEvent.click(submit)
    expect(create).toHaveBeenCalledWith({ name: 'grace', email: undefined, prompt_text: 'bid low' })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('sends the email when given', async () => {
    render(<PlayerDialog open player={null} onClose={onClose} />)
    await userEvent.type(screen.getByLabelText('Nick'), 'g')
    await userEvent.type(screen.getByLabelText('Email (optional)'), 'g@x.io')
    await userEvent.type(screen.getByLabelText('Prompt'), 'p')
    await userEvent.click(screen.getByRole('button', { name: 'Add player' }))
    expect(create).toHaveBeenCalledWith({ name: 'g', email: 'g@x.io', prompt_text: 'p' })
  })

  it('pre-fills and adds a version when only the prompt changed', async () => {
    render(<PlayerDialog open player={player} onClose={onClose} />)
    expect(screen.getByLabelText('Nick')).toHaveValue('ada')
    expect(screen.getByLabelText('Email (optional)')).toHaveValue('ada@x.io')
    expect(screen.getByText('Saving a changed prompt creates version 3.')).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Prompt'))
    await userEvent.type(screen.getByLabelText('Prompt'), 'new prompt')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(addVersion).toHaveBeenCalledWith({ id: 'p1', prompt_text: 'new prompt' })
    expect(update).not.toHaveBeenCalled()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('updates only the player when only the nick changed', async () => {
    render(<PlayerDialog open player={player} onClose={onClose} />)
    await userEvent.type(screen.getByLabelText('Nick'), '2')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(update).toHaveBeenCalledWith({ id: 'p1', name: 'ada2' })
    expect(addVersion).not.toHaveBeenCalled()
  })

  it('clears the email with an empty string and omits the unchanged nick', async () => {
    render(<PlayerDialog open player={{ ...player, email: 'a@x.pl' }} onClose={onClose} />)
    await userEvent.clear(screen.getByLabelText('Email (optional)'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(update).toHaveBeenCalledWith({ id: 'p1', email: '' })
    expect(addVersion).not.toHaveBeenCalled()
  })

  it('does nothing but close when unchanged', async () => {
    render(<PlayerDialog open player={player} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(update).not.toHaveBeenCalled()
    expect(addVersion).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('handles a player without a current version', async () => {
    render(<PlayerDialog open player={{ ...player, email: null, current_version: null }} onClose={onClose} />)
    expect(screen.getByText('Saving a changed prompt creates version 1.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Prompt'), 'first')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(addVersion).toHaveBeenCalledWith({ id: 'p1', prompt_text: 'first' })
  })

  it('shows the backend error and stays open', async () => {
    create.mockRejectedValue(new Error('nick taken'))
    render(<PlayerDialog open player={null} onClose={onClose} />)
    await userEvent.type(screen.getByLabelText('Nick'), 'g')
    await userEvent.type(screen.getByLabelText('Prompt'), 'p')
    await userEvent.click(screen.getByRole('button', { name: 'Add player' }))
    expect(await screen.findByText('msg:nick taken')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('cancels', async () => {
    render(<PlayerDialog open player={null} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })
})
