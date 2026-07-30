import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AdminPage } from './AdminPage'
import * as hooks from '../api/hooks'

vi.mock('../api/hooks', () => ({
  usePrompts: vi.fn(),
  useUpdatePromptStatus: vi.fn(),
}))

describe('AdminPage', () => {
  it('renders the AdminPanel', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(hooks.usePrompts).mockReturnValue({ data: [] } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(hooks.useUpdatePromptStatus).mockReturnValue({ mutate: vi.fn() } as any)

    render(<AdminPage />)
    expect(screen.getByRole('heading', { name: 'Admin' })).toBeInTheDocument()
    expect(screen.getByText('Review queue')).toBeInTheDocument()
  })
})
