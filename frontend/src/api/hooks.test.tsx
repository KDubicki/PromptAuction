import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from './client'
import { AxiosError, AxiosHeaders } from 'axios'

import {
  apiErrorMessage,
  useConnectGoogleForm,
  useDisconnectGoogleForm,
  useEntryForm,
  useGameSessions,
  useGoogleFormStatus,
  usePrompts,
  useSyncGoogleForm,
  useUpdatePromptStatus,
} from './hooks'

vi.mock('./client', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
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

function axiosError(status?: number, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const response =
    status === undefined
      ? undefined
      : { status, statusText: '', headers: {}, config, data }
  return new AxiosError('failed', 'ERR', config, null, response)
}

describe('apiErrorMessage', () => {
  it('prefers the backend detail message', () => {
    expect(apiErrorMessage(axiosError(403, { detail: 'No access.' }))).toBe('No access.')
  })

  it('explains when the API cannot be reached', () => {
    expect(apiErrorMessage(axiosError())).toBe('Cannot reach the API server.')
  })

  it('falls back to a generic message', () => {
    expect(apiErrorMessage(axiosError(422, { detail: [{ msg: 'x' }] }))).toBe('Something went wrong. Try again.')
    expect(apiErrorMessage(new Error('x'))).toBe('Something went wrong. Try again.')
  })
})

describe('Google Form hooks', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
  })

  it('loads the admin form status', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { credentials_configured: true, form: null } })
    const { result } = renderHook(() => useGoogleFormStatus(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/admin/google-form')
    expect(result.current.data?.credentials_configured).toBe(true)
  })

  it('connects, syncs and disconnects through the admin endpoints', async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { form: { form_id: 'abc' } } })
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { imported: 1, skipped: 0 } })
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: undefined })
    const wrapper = createWrapper()

    const connect = renderHook(() => useConnectGoogleForm(), { wrapper })
    connect.result.current.mutate('https://docs.google.com/forms/d/abc/edit')
    await waitFor(() => expect(connect.result.current.isSuccess).toBe(true))
    expect(apiClient.put).toHaveBeenCalledWith('/admin/google-form', {
      url: 'https://docs.google.com/forms/d/abc/edit',
    })

    const sync = renderHook(() => useSyncGoogleForm(), { wrapper })
    sync.result.current.mutate(undefined)
    await waitFor(() => expect(sync.result.current.data).toEqual({ imported: 1, skipped: 0 }))
    expect(apiClient.post).toHaveBeenCalledWith('/admin/google-form/sync')

    const disconnect = renderHook(() => useDisconnectGoogleForm(), { wrapper })
    disconnect.result.current.mutate(undefined)
    await waitFor(() => expect(disconnect.result.current.isSuccess).toBe(true))
    expect(apiClient.delete).toHaveBeenCalledWith('/admin/google-form')
  })

  it('returns the public entry form, or null when none is connected', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { title: 'T', responder_url: 'https://x' } })
    const first = renderHook(() => useEntryForm(), { wrapper: createWrapper() })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    expect(first.result.current.data).toEqual({ title: 'T', responder_url: 'https://x' })
    expect(apiClient.get).toHaveBeenCalledWith('/entry-form')

    vi.mocked(apiClient.get).mockRejectedValueOnce(axiosError(404, { detail: 'none' }))
    const second = renderHook(() => useEntryForm(), { wrapper: createWrapper() })
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))
    expect(second.result.current.data).toBeNull()
  })
})
