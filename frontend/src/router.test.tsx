import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { router } from './router'
import * as hooks from './api/hooks'

vi.mock('./api/hooks', () => ({
  usePrompts: vi.fn(),
  useUpdatePromptStatus: vi.fn(),
}))

function renderRouter() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('router', () => {
  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(hooks.usePrompts).mockReturnValue({ data: [] } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(hooks.useUpdatePromptStatus).mockReturnValue({ mutate: vi.fn() } as any)
    await act(async () => {
      await router.navigate('/')
    })
  })

  it('renders the GamePage at the index route', () => {
    renderRouter()
    expect(screen.getByText('Live Game Dashboard')).toBeInTheDocument()
  })

  it('navigates to the admin route', async () => {
    renderRouter()
    await act(async () => {
      await router.navigate('/admin')
    })
    expect(screen.getByText('Admin Panel')).toBeInTheDocument()
  })

  it('navigates to the leaderboard route', async () => {
    renderRouter()
    await act(async () => {
      await router.navigate('/leaderboard')
    })
    expect(screen.getByRole('heading', { name: 'Leaderboard' })).toBeInTheDocument()
  })

  it('navigates to the submit route', async () => {
    renderRouter()
    await act(async () => {
      await router.navigate('/submit')
    })
    expect(screen.getByText('Submit Your Prompt')).toBeInTheDocument()
  })

  it('renders the NotFoundPage for unknown routes', async () => {
    renderRouter()
    await act(async () => {
      await router.navigate('/does-not-exist')
    })
    expect(screen.getByText('404')).toBeInTheDocument()
  })
})
