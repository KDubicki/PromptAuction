import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SessionsPanel } from './SessionsPanel'
import * as hooks from '../api/hooks'
import type { GameSession, GameStatus } from '../types'

vi.mock('../api/hooks', () => ({
  apiErrorMessage: vi.fn((e: unknown) => `msg:${(e as Error).message}`),
  useGameSessions: vi.fn(),
  useCreateGameSession: vi.fn(),
}))

const make = (id: string, status: GameStatus, n = 0): GameSession => ({
  id,
  name: `Session ${id}`,
  status,
  roster: Array.from({ length: n }, (_, i) => ({
    player_ref: `p${i}`, name: `P${i}`, current_version: 1, version_id: null, version: null, prompt_text: null,
  })),
  start_blockers: [],
  current_round: 0,
  current_iteration: 0,
  started_at: null,
})

const mutateAsync = vi.fn()
const onSelect = vi.fn()

function setup(sessions: GameSession[], createState = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(hooks.useGameSessions).mockReturnValue({ data: sessions, isLoading: false, isError: false } as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(hooks.useCreateGameSession).mockReturnValue({ mutateAsync, isPending: false, isError: false, ...createState } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  mutateAsync.mockResolvedValue(make('new', 'pending'))
})

describe('SessionsPanel', () => {
  it('shows status labels and player counts', () => {
    setup([make('1', 'pending', 2), make('2', 'running', 1), make('3', 'paused'), make('4', 'completed')])
    render(<SessionsPanel selectedId={null} onSelect={onSelect} />)
    expect(screen.getByText('Waiting to start')).toBeInTheDocument()
    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('2 players')).toBeInTheDocument()
    expect(screen.getByText('4 sessions')).toBeInTheDocument()
  })

  it('uses the singular for one player and one session', () => {
    setup([make('1', 'pending', 1)])
    render(<SessionsPanel selectedId={null} onSelect={onSelect} />)
    expect(screen.getByText('1 player')).toBeInTheDocument()
    expect(screen.getByText('1 session')).toBeInTheDocument()
  })

  it('gives the session name field an accessible name', () => {
    setup([])
    render(<SessionsPanel selectedId={null} onSelect={onSelect} />)
    expect(screen.getByRole('textbox', { name: 'Session name' })).toBeInTheDocument()
  })

  it('selects a session on click', async () => {
    setup([make('1', 'pending')])
    render(<SessionsPanel selectedId={null} onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: /Session 1/ }))
    expect(onSelect).toHaveBeenCalledWith('1')
  })

  it('marks the selected row', () => {
    setup([make('1', 'pending')])
    render(<SessionsPanel selectedId="1" onSelect={onSelect} />)
    expect(screen.getByRole('button', { name: /Session 1/ })).toHaveAttribute('aria-current', 'true')
  })

  it('creates a session with a trimmed name and selects it', async () => {
    setup([])
    render(<SessionsPanel selectedId={null} onSelect={onSelect} />)
    const create = screen.getByRole('button', { name: 'New session' })
    expect(create).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Session name'), '  Friday  ')
    await userEvent.click(create)
    expect(mutateAsync).toHaveBeenCalledWith('Friday')
    expect(onSelect).toHaveBeenCalledWith('new')
    expect(screen.getByLabelText('Session name')).toHaveValue('')
  })

  it('keeps the button disabled for blank or over-long names', async () => {
    setup([])
    render(<SessionsPanel selectedId={null} onSelect={onSelect} />)
    await userEvent.type(screen.getByLabelText('Session name'), '   ')
    expect(screen.getByRole('button', { name: 'New session' })).toBeDisabled()
    await userEvent.clear(screen.getByLabelText('Session name'))
    await userEvent.click(screen.getByLabelText('Session name'))
    await userEvent.paste('x'.repeat(201))
    expect(screen.getByRole('button', { name: 'New session' })).toBeDisabled()
  })

  it('creates on Enter', async () => {
    setup([])
    render(<SessionsPanel selectedId={null} onSelect={onSelect} />)
    await userEvent.type(screen.getByLabelText('Session name'), 'Quick{Enter}')
    expect(mutateAsync).toHaveBeenCalledWith('Quick')
  })

  it('shows the create error and does not select', async () => {
    setup([])
    mutateAsync.mockRejectedValue(new Error('boom'))
    render(<SessionsPanel selectedId={null} onSelect={onSelect} />)
    await userEvent.type(screen.getByLabelText('Session name'), 'A')
    await userEvent.click(screen.getByRole('button', { name: 'New session' }))
    expect(await screen.findByText('msg:boom')).toBeInTheDocument()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows an empty state', () => {
    setup([])
    render(<SessionsPanel selectedId={null} onSelect={onSelect} />)
    expect(screen.getByText(/No sessions yet/)).toBeInTheDocument()
  })

  it('shows a load error', () => {
    setup([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(hooks.useGameSessions).mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('down') } as any)
    render(<SessionsPanel selectedId={null} onSelect={onSelect} />)
    expect(screen.getByText('msg:down')).toBeInTheDocument()
  })
})
