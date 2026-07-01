import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as hooks from '../api/hooks'
import type { PromptSubmission } from '../types'

vi.mock('../api/hooks', () => ({
  usePrompts: vi.fn(),
}))

function mockPrompts(data: PromptSubmission[], overrides: Record<string, unknown> = {}) {
  vi.mocked(hooks.usePrompts).mockReturnValue({
    data,
    refetch: vi.fn(),
    isFetching: false,
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

describe('SubmitPromptPage', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('shows a placeholder message when VITE_GOOGLE_FORM_URL is not configured', async () => {
    mockPrompts([])
    const { SubmitPromptPage } = await import('./SubmitPromptPage')
    render(<SubmitPromptPage />)
    expect(screen.getByText(/Google Form not configured/)).toBeInTheDocument()
  })

  it('embeds the Google Form iframe when VITE_GOOGLE_FORM_URL is set', async () => {
    vi.stubEnv('VITE_GOOGLE_FORM_URL', 'https://docs.google.com/forms/d/e/abc/viewform?embedded=true')
    mockPrompts([])
    const { SubmitPromptPage } = await import('./SubmitPromptPage')
    render(<SubmitPromptPage />)
    expect(screen.getByTitle('Submit Prompt Form')).toHaveAttribute(
      'src',
      'https://docs.google.com/forms/d/e/abc/viewform?embedded=true',
    )
  })

  it('disables the Check button until a player id is entered', async () => {
    mockPrompts([])
    const { SubmitPromptPage } = await import('./SubmitPromptPage')
    render(<SubmitPromptPage />)
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled()
  })

  it('shows a loading label and disables the button while fetching', async () => {
    mockPrompts([], { isFetching: true })
    const { SubmitPromptPage } = await import('./SubmitPromptPage')
    render(<SubmitPromptPage />)
    expect(screen.getByRole('button', { name: 'Checking...' })).toBeDisabled()
  })

  it('shows a no-results message when searching finds nothing', async () => {
    mockPrompts([])
    const user = userEvent.setup()
    const { SubmitPromptPage } = await import('./SubmitPromptPage')
    render(<SubmitPromptPage />)

    await user.type(screen.getByLabelText('Your Player ID'), 'ghost')
    await user.click(screen.getByRole('button', { name: 'Check' }))

    expect(await screen.findByText('No submissions found for "ghost".')).toBeInTheDocument()
  })

  it('filters and displays matching submissions with status chips', async () => {
    mockPrompts([
      { id: '1', player_id: 'p1', prompt_text: 'Bid low.', status: 'accepted' },
      { id: '2', player_id: 'p1', prompt_text: 'Bid high.', status: 'rejected' },
      { id: '3', player_id: 'p2', prompt_text: 'Other.', status: 'pending' },
    ])
    const user = userEvent.setup()
    const { SubmitPromptPage } = await import('./SubmitPromptPage')
    render(<SubmitPromptPage />)

    await user.type(screen.getByLabelText('Your Player ID'), 'p1')
    await user.click(screen.getByRole('button', { name: 'Check' }))

    expect(await screen.findByText('Bid low.')).toBeInTheDocument()
    expect(screen.getByText('Bid high.')).toBeInTheDocument()
    expect(screen.queryByText('Other.')).not.toBeInTheDocument()
    expect(screen.getByText('accepted')).toBeInTheDocument()
    expect(screen.getByText('rejected')).toBeInTheDocument()
  })

  it('re-runs the search when Enter is pressed in the input', async () => {
    mockPrompts([{ id: '1', player_id: 'p9', prompt_text: 'Only bid on shiny things.', status: 'pending' }])
    const user = userEvent.setup()
    const { SubmitPromptPage } = await import('./SubmitPromptPage')
    render(<SubmitPromptPage />)

    await user.type(screen.getByLabelText('Your Player ID'), 'p9{Enter}')

    expect(await screen.findByText('Only bid on shiny things.')).toBeInTheDocument()
    expect(screen.getByText('pending')).toBeInTheDocument()
  })
})
