import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AdminPanel } from './AdminPanel'
import * as hooks from '../api/hooks'
import type { PromptSubmission } from '../types'

vi.mock('../api/hooks', () => ({
  usePrompts: vi.fn(),
  useUpdatePromptStatus: vi.fn(),
}))

const mockedUsePrompts = vi.mocked(hooks.usePrompts)
const mockedUseUpdatePromptStatus = vi.mocked(hooks.useUpdatePromptStatus)

function makePrompt(overrides: Partial<PromptSubmission> = {}): PromptSubmission {
  return { id: '1', player_id: 'p1', prompt_text: 'Bid low.', status: 'pending', ...overrides }
}

describe('AdminPanel', () => {
  const mutate = vi.fn()

  beforeEach(() => {
    mutate.mockClear()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedUseUpdatePromptStatus.mockReturnValue({ mutate } as any)
  })

  it('shows an empty-state message when there are no pending prompts', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedUsePrompts.mockReturnValue({ data: [] } as any)
    render(<AdminPanel />)
    expect(screen.getByText('No pending prompts to review.')).toBeInTheDocument()
  })

  it('lists pending prompts and lets the admin accept/reject them', async () => {
    const user = userEvent.setup()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedUsePrompts.mockReturnValue({ data: [makePrompt()] } as any)
    render(<AdminPanel />)

    expect(screen.getByText('Player: p1')).toBeInTheDocument()
    expect(screen.getByText('Bid low.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Accept' }))
    expect(mutate).toHaveBeenCalledWith({ id: '1', status: 'accepted' })

    await user.click(screen.getByRole('button', { name: 'Reject' }))
    expect(mutate).toHaveBeenCalledWith({ id: '1', status: 'rejected' })
  })

  it('defaults to an empty list when data is undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedUsePrompts.mockReturnValue({ data: undefined } as any)
    render(<AdminPanel />)
    expect(screen.getByText('No pending prompts to review.')).toBeInTheDocument()
  })
})
