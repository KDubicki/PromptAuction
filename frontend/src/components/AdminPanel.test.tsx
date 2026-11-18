import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AdminPanel } from './AdminPanel'
import * as hooks from '../api/hooks'
import type { GameSession, PromptSubmission } from '../types'

vi.mock('./GoogleFormSourcePanel', () => ({ GoogleFormSourcePanel: () => null }))

vi.mock('./SessionsPanel', () => ({
  SessionsPanel: ({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) => (
    <div>
      <span data-testid="selected">{selectedId ?? 'none'}</span>
      <button onClick={() => onSelect('s-old')}>pick old</button>
    </div>
  ),
}))
vi.mock('./SessionRoster', () => ({
  SessionRoster: ({ session }: { session: { id: string } }) => <div>roster {session.id}</div>,
}))
vi.mock('./PlayersPanel', () => ({ PlayersPanel: () => null }))

vi.mock('../api/hooks', () => ({
  usePrompts: vi.fn(),
  useUpdatePromptStatus: vi.fn(),
  useGameSessions: vi.fn(),
}))

const mockedUsePrompts = vi.mocked(hooks.usePrompts)
const mockedUseUpdatePromptStatus = vi.mocked(hooks.useUpdatePromptStatus)
const mockedUseGameSessions = vi.mocked(hooks.useGameSessions)

function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    id: 's1',
    name: 'Evening',
    status: 'pending',
    roster: [],
    start_blockers: [],
    current_round: 0,
    current_iteration: 0,
    started_at: null,
    created_at: '2026-11-01T10:00:00Z',
    ...overrides,
  }
}

function setSessions(sessions: GameSession[] | undefined) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseGameSessions.mockReturnValue({ data: sessions } as any)
}

function makePrompt(overrides: Partial<PromptSubmission> = {}): PromptSubmission {
  return { id: '1', player_id: 'p1', prompt_text: 'Bid low.', status: 'pending', ...overrides }
}

const EMPTY_QUEUE = 'The queue is clear. New submissions land here for review.'

describe('AdminPanel', () => {
  const mutate = vi.fn()

  beforeEach(() => {
    mutate.mockClear()
    setSessions([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedUseUpdatePromptStatus.mockReturnValue({ mutate, isPending: false } as any)
  })

  it('shows an empty-state message when there are no pending prompts', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedUsePrompts.mockReturnValue({ data: [] } as any)
    render(<AdminPanel />)
    expect(screen.getByText(EMPTY_QUEUE)).toBeInTheDocument()
    expect(screen.getByText('0 pending')).toBeInTheDocument()
  })

  it('lists pending prompts and lets the admin accept/reject them', async () => {
    const user = userEvent.setup()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedUsePrompts.mockReturnValue({ data: [makePrompt()] } as any)
    render(<AdminPanel />)

    expect(screen.getByText('p1')).toBeInTheDocument()
    expect(screen.getByText('Bid low.')).toBeInTheDocument()
    expect(screen.getByText('1 pending')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Accept' }))
    expect(mutate).toHaveBeenCalledWith({ id: '1', status: 'accepted' })

    await user.click(screen.getByRole('button', { name: 'Reject' }))
    expect(mutate).toHaveBeenCalledWith({ id: '1', status: 'rejected' })
  })

  it('disables both verdicts while a status update is in flight', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedUseUpdatePromptStatus.mockReturnValue({ mutate, isPending: true } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedUsePrompts.mockReturnValue({ data: [makePrompt()] } as any)
    render(<AdminPanel />)

    expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled()
  })

  it('defaults to an empty list when data is undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedUsePrompts.mockReturnValue({ data: undefined } as any)
    render(<AdminPanel />)
    expect(screen.getByText(EMPTY_QUEUE)).toBeInTheDocument()
  })

  it('shows New player for version 1 and Version N otherwise, with the source', () => {
    mockedUsePrompts.mockReturnValue({
      data: [
        makePrompt({ id: '1', version: 1, source: 'google_forms' }),
        makePrompt({ id: '2', version: 4, source: 'webhook', prompt_text: 'Other.' }),
        makePrompt({ id: '3', version: 2, source: 'admin', prompt_text: 'Third.' }),
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    render(<AdminPanel />)
    expect(screen.getByText('New player · from Google Form')).toBeInTheDocument()
    expect(screen.getByText('Version 4 · via webhook')).toBeInTheDocument()
    expect(screen.getByText('Version 2')).toBeInTheDocument()
  })

  it('shows the email warning only when the identity warning is set', () => {
    mockedUsePrompts.mockReturnValue({
      data: [
        makePrompt({ id: '1', identity_warning: 'email_mismatch', email: 'x@y.z' }),
        makePrompt({ id: '2', identity_warning: 'email_mismatch', email: null, prompt_text: 'B.' }),
        makePrompt({ id: '3', prompt_text: 'C.' }),
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    render(<AdminPanel />)
    expect(screen.getAllByRole('alert')).toHaveLength(2)
    expect(
      screen.getByText("Email differs from this player's. Submitted with x@y.z."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Email differs from this player's. Submitted with no email."),
    ).toBeInTheDocument()
  })

  describe('selected session', () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockedUsePrompts.mockReturnValue({ data: [] } as any)
    })

    it('renders no roster when there are no sessions', () => {
      render(<AdminPanel />)
      expect(screen.getByTestId('selected')).toHaveTextContent('none')
      expect(screen.queryByText(/^roster/)).not.toBeInTheDocument()
    })

    it('defaults to the newest pending session', () => {
      setSessions([
        makeSession({ id: 's-old', created_at: '2026-11-01T10:00:00Z' }),
        makeSession({ id: 's-new', created_at: '2026-11-03T10:00:00Z' }),
        makeSession({ id: 's-run', status: 'running', created_at: '2026-11-05T10:00:00Z' }),
      ])
      render(<AdminPanel />)
      expect(screen.getByTestId('selected')).toHaveTextContent('s-new')
      expect(screen.getByText('roster s-new')).toBeInTheDocument()
    })

    it('defaults to the newest session when none is pending', () => {
      setSessions([
        makeSession({ id: 'a', status: 'completed', created_at: '2026-11-01T10:00:00Z' }),
        makeSession({ id: 'b', status: 'running', created_at: '2026-11-04T10:00:00Z' }),
        makeSession({ id: 'c', status: 'paused', created_at: null }),
      ])
      render(<AdminPanel />)
      expect(screen.getByTestId('selected')).toHaveTextContent('b')
    })

    it('keeps an explicit selection and falls back when it disappears', async () => {
      const user = userEvent.setup()
      setSessions([
        makeSession({ id: 's-old', created_at: '2026-11-01T10:00:00Z' }),
        makeSession({ id: 's-new', created_at: '2026-11-03T10:00:00Z' }),
      ])
      const { rerender } = render(<AdminPanel />)
      await user.click(screen.getByRole('button', { name: 'pick old' }))
      expect(screen.getByTestId('selected')).toHaveTextContent('s-old')

      setSessions([makeSession({ id: 's-new', created_at: '2026-11-03T10:00:00Z' })])
      rerender(<AdminPanel />)
      expect(screen.getByTestId('selected')).toHaveTextContent('s-new')
    })
  })
})
