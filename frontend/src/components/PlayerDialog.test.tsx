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
  latest_version: 2,
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
  it('labels the prompt field as the agent prompt with guidance', () => {
    render(<PlayerDialog open player={null} onClose={onClose} />)
    expect(screen.getByLabelText('Agent prompt')).toBeInTheDocument()
    expect(screen.getByText('Give your agent a persona and tell it what to check and how to bid.')).toBeInTheDocument()
  })

  it('creates a player with undefined email when blank', async () => {
    render(<PlayerDialog open player={null} onClose={onClose} />)
    const submit = screen.getByRole('button', { name: 'Add player' })
    expect(submit).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Nick'), ' grace ')
    await userEvent.type(screen.getByLabelText('Agent prompt'), 'bid low')
    await userEvent.click(submit)
    expect(create).toHaveBeenCalledWith({ name: 'grace', email: undefined, prompt_text: 'bid low' })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('sends the email when given', async () => {
    render(<PlayerDialog open player={null} onClose={onClose} />)
    await userEvent.type(screen.getByLabelText('Nick'), 'g')
    await userEvent.type(screen.getByLabelText('Email (optional)'), 'g@x.io')
    await userEvent.type(screen.getByLabelText('Agent prompt'), 'prompt')
    await userEvent.click(screen.getByRole('button', { name: 'Add player' }))
    expect(create).toHaveBeenCalledWith({ name: 'g', email: 'g@x.io', prompt_text: 'prompt' })
  })

  it('pre-fills and adds a version when only the prompt changed', async () => {
    render(<PlayerDialog open player={player} onClose={onClose} />)
    expect(screen.getByLabelText('Nick')).toHaveValue('ada')
    expect(screen.getByLabelText('Email (optional)')).toHaveValue('ada@x.io')
    expect(screen.getByText('Give your agent a persona and tell it what to check and how to bid. Saving a changed prompt creates version 3.')).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Agent prompt'))
    await userEvent.type(screen.getByLabelText('Agent prompt'), 'new prompt')
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
    render(<PlayerDialog open player={{ ...player, email: null, current_version: null, latest_version: 0 }} onClose={onClose} />)
    expect(screen.getByText('Give your agent a persona and tell it what to check and how to bid. Saving a changed prompt creates version 1.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Agent prompt'), 'first')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(addVersion).toHaveBeenCalledWith({ id: 'p1', prompt_text: 'first' })
  })

  it('shows the backend error and stays open', async () => {
    create.mockRejectedValue(new Error('nick taken'))
    render(<PlayerDialog open player={null} onClose={onClose} />)
    await userEvent.type(screen.getByLabelText('Nick'), 'g')
    await userEvent.type(screen.getByLabelText('Agent prompt'), 'prompt')
    await userEvent.click(screen.getByRole('button', { name: 'Add player' }))
    expect(await screen.findByText('msg:nick taken')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('retries only the prompt after a partial failure', async () => {
    addVersion.mockRejectedValueOnce(new Error('too long')).mockResolvedValue({})
    render(<PlayerDialog open player={player} onClose={onClose} />)
    await userEvent.type(screen.getByLabelText('Nick'), '2')
    await userEvent.clear(screen.getByLabelText('Agent prompt'))
    await userEvent.type(screen.getByLabelText('Agent prompt'), 'new prompt')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByText('Saved the nick and email, but the new prompt version failed: msg:too long'),
    ).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(update).toHaveBeenCalledTimes(1)
    expect(addVersion).toHaveBeenCalledTimes(2)
  })

  it('disables Save for an emptied or too-short prompt in edit mode', async () => {
    render(<PlayerDialog open player={player} onClose={onClose} />)
    const save = screen.getByRole('button', { name: 'Save' })
    await userEvent.clear(screen.getByLabelText('Agent prompt'))
    expect(save).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Agent prompt'), 'ab')
    expect(save).toBeDisabled()
    expect(screen.getByText('Prompt must be 3–2000 characters.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Agent prompt'), 'c')
    expect(save).toBeEnabled()
  })

  it('disables Add player for a too-short prompt and over-long fields', async () => {
    render(<PlayerDialog open player={null} onClose={onClose} />)
    const submit = screen.getByRole('button', { name: 'Add player' })
    await userEvent.type(screen.getByLabelText('Nick'), 'g')
    await userEvent.type(screen.getByLabelText('Agent prompt'), 'ab')
    expect(submit).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Agent prompt'), 'c')
    expect(submit).toBeEnabled()
    await userEvent.type(screen.getByLabelText('Nick'), 'x'.repeat(100))
    expect(submit).toBeDisabled()
    expect(screen.getByText('Nick must be 1–100 characters.')).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Nick'))
    await userEvent.type(screen.getByLabelText('Nick'), 'g')
    await userEvent.click(screen.getByLabelText('Email (optional)'))
    await userEvent.paste('e'.repeat(321))
    expect(submit).toBeDisabled()
    expect(screen.getByText('Email must be at most 320 characters.')).toBeInTheDocument()
  })

  it('rejects a prompt over 2000 characters', async () => {
    render(<PlayerDialog open player={null} onClose={onClose} />)
    await userEvent.type(screen.getByLabelText('Nick'), 'g')
    await userEvent.click(screen.getByLabelText('Agent prompt'))
    await userEvent.paste('p'.repeat(2001))
    expect(screen.getByRole('button', { name: 'Add player' })).toBeDisabled()
  })

  it('cancels', async () => {
    render(<PlayerDialog open player={null} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('hints the next version from the latest version, including pending ones', () => {
    render(<PlayerDialog open player={{ ...player, latest_version: 5 }} onClose={onClose} />)
    expect(screen.getByText('Give your agent a persona and tell it what to check and how to bid. Saving a changed prompt creates version 6.')).toBeInTheDocument()
  })

  it('blocks Cancel while saving', async () => {
    let release: () => void = () => {}
    update.mockReturnValue(new Promise<void>((resolve) => { release = resolve }))
    render(<PlayerDialog open player={player} onClose={onClose} />)
    await userEvent.type(screen.getByLabelText('Nick'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    release()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
