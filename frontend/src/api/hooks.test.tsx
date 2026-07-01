import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from './client'
import { usePrompts, useUpdatePromptStatus, useGameSessions } from './hooks'

vi.mock('./client', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn() },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('usePrompts', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
  })

  it('returns prompts from the API without a status filter', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [{ id: '1', player_id: 'p1', prompt_text: 'x', status: 'pending' }],
    })
    const { result } = renderHook(() => usePrompts(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(apiClient.get).toHaveBeenCalledWith('/prompts', { params: undefined })
  })

  it('passes status_filter as a query param when provided', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] })
    const { result } = renderHook(() => usePrompts('accepted'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/prompts', { params: { status_filter: 'accepted' } })
  })

  it('falls back to filtered mock data when the request fails and a status filter is set', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('network down'))
    const { result } = renderHook(() => usePrompts('accepted'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([
      { id: '2', player_id: 'p2', prompt_text: 'Bid aggressively in early rounds.', status: 'accepted' },
    ])
  })

  it('falls back to the full mock list when the request fails without a status filter', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('network down'))
    const { result } = renderHook(() => usePrompts(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
  })
})

describe('useUpdatePromptStatus', () => {
  beforeEach(() => {
    vi.mocked(apiClient.patch).mockReset()
  })

  it('PATCHes the prompt status and invalidates the prompts query on success', async () => {
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: {} })
    const { result } = renderHook(() => useUpdatePromptStatus(), { wrapper: createWrapper() })

    result.current.mutate({ id: '1', status: 'accepted' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.patch).toHaveBeenCalledWith('/prompts/1/status', { status: 'accepted' })
  })
})

describe('useGameSessions', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
  })

  it('returns sessions from the API', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [{ id: 's1', name: 'Test', status: 'running', current_round: 1, current_iteration: 1 }],
    })
    const { result } = renderHook(() => useGameSessions(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('falls back to mock sessions when the request fails', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('network down'))
    const { result } = renderHook(() => useGameSessions(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([
      { id: '1', name: 'Evening Match', status: 'running', current_round: 2, current_iteration: 15 },
    ])
  })
})
