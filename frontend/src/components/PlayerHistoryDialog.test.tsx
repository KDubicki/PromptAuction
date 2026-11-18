import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PlayerHistoryDialog } from './PlayerHistoryDialog'
import * as hooks from '../api/hooks'
import type { PromptSource, PromptVersion } from '../types'

vi.mock('../api/hooks', () => ({
  apiErrorMessage: vi.fn(() => 'boom'),
  usePlayer: vi.fn(),
}))

function ver(version: number, source: PromptSource, created_at: string | null = '2026-11-18T10:00:00Z'): PromptVersion {
  return {
    id: `v${version}`, version, prompt_text: `text ${version}`, status: 'accepted', source,
    player_name: 'ada', identity_warning: null, email: null, created_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPlayer = (r: Record<string, unknown>) => vi.mocked(hooks.usePlayer).mockReturnValue(r as any)

beforeEach(() => vi.clearAllMocks())

describe('PlayerHistoryDialog', () => {
  it('lists versions newest first and marks the current one', async () => {
    const versions = [ver(4, 'google_forms'), ver(3, 'webhook'), ver(2, 'migration', null), ver(1, 'admin')]
    mockPlayer({ data: { id: 'p', name: 'ada', current_version: versions[1], versions } })
    const onClose = vi.fn()
    render(<PlayerHistoryDialog playerId="p" onClose={onClose} />)
    const items = screen.getAllByRole('listitem')
    expect(items.map((i) => within(i).getByText(/^v\d$/).textContent)).toEqual(['v4', 'v3', 'v2', 'v1'])
    expect(within(items[1]).getByText('Current')).toBeInTheDocument()
    expect(screen.getAllByText('Current')).toHaveLength(1)
    expect(screen.getByText(/Google Form/)).toBeInTheDocument()
    expect(screen.getByText(/Webhook/)).toBeInTheDocument()
    expect(screen.getByText(/Imported/)).toBeInTheDocument()
    expect(screen.getByText(/Added by admin/)).toBeInTheDocument()
    expect(screen.getByText('text 4')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows loading and error states', () => {
    mockPlayer({ isLoading: true })
    const { rerender } = render(<PlayerHistoryDialog playerId="p" onClose={vi.fn()} />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    mockPlayer({ isError: true, error: new Error('x') })
    rerender(<PlayerHistoryDialog playerId="p" onClose={vi.fn()} />)
    expect(screen.getByText('boom')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    mockPlayer({})
    render(<PlayerHistoryDialog playerId={null} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
