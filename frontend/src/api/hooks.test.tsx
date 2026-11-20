import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from './client'
import { AxiosError, AxiosHeaders } from 'axios'

import {
  apiErrorMessage,
  useAddPromptVersion,
  useAddToRoster,
  useConnectGoogleForm,
  useCreateGameSession,
  useCreatePlayer,
  useDeletePlayer,
  useDisconnectGoogleForm,
  useEntryForm,
  useGameSessions,
  useGoogleFormStatus,
  usePlayer,
  usePlayers,
  useRemoveFromRoster,
  useSessionBids,
  useStartGameSession,
  useUpdatePlayer,
  useUpdateSessionSettings,
  useUpdateSessionStatus,
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

  it('PATCHes the prompt status and invalidates prompts, players and sessions on success', async () => {
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: {} })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useUpdatePromptStatus(), { wrapper })

    result.current.mutate({ id: '1', status: 'accepted' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.patch).toHaveBeenCalledWith('/prompts/1/status', { status: 'accepted' })
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey)
    expect(keys).toEqual(expect.arrayContaining([['prompts'], ['players'], ['game-sessions']]))
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

  it('surfaces errors instead of falling back to mock sessions', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('network down'))
    const { result } = renderHook(() => useGameSessions(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
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

  it('google form mutations also invalidate players and game sessions', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { imported: 1, skipped: 0 } })
    const queryClient = new QueryClient()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const sync = renderHook(() => useSyncGoogleForm(), { wrapper })
    sync.result.current.mutate(undefined)
    await waitFor(() => expect(sync.result.current.isSuccess).toBe(true))
    await waitFor(() => {
      const keys = spy.mock.calls.map((c) => (c[0] as { queryKey: string[] }).queryKey[0])
      expect(keys).toEqual(expect.arrayContaining(['players', 'game-sessions']))
    })
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

describe('player and roster hooks', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.post).mockReset().mockResolvedValue({ data: {} })
    vi.mocked(apiClient.patch).mockReset().mockResolvedValue({ data: {} })
    vi.mocked(apiClient.delete).mockReset().mockResolvedValue({ data: {} })
  })

  it('usePlayers lists players and surfaces errors', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [{ id: 'p1' }] })
    const { result } = renderHook(() => usePlayers(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/players')

    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('down'))
    const failing = renderHook(() => usePlayers(), { wrapper: createWrapper() })
    await waitFor(() => expect(failing.result.current.isError).toBe(true))
  })

  it('usePlayer fetches one player', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { id: 'p1', versions: [] } })
    const { result } = renderHook(() => usePlayer('p1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/players/p1')
  })

  it('usePlayer does not call the API without an id', () => {
    renderHook(() => usePlayer(null), { wrapper: createWrapper() })
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('useCreatePlayer posts the body', async () => {
    const { result } = renderHook(() => useCreatePlayer(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ name: 'Ann', prompt_text: 'hi' })
    expect(apiClient.post).toHaveBeenCalledWith('/players', { name: 'Ann', prompt_text: 'hi' })
  })

  it('useUpdatePlayer patches without the id in the body', async () => {
    const { result } = renderHook(() => useUpdatePlayer(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ id: 'p1', name: 'Bob' })
    expect(apiClient.patch).toHaveBeenCalledWith('/players/p1', { name: 'Bob' })
  })

  it('useAddPromptVersion posts a new version', async () => {
    const { result } = renderHook(() => useAddPromptVersion(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ id: 'p1', prompt_text: 'v2' })
    expect(apiClient.post).toHaveBeenCalledWith('/players/p1/versions', { prompt_text: 'v2' })
  })

  it('useDeletePlayer deletes the player', async () => {
    const { result } = renderHook(() => useDeletePlayer(), { wrapper: createWrapper() })
    await result.current.mutateAsync('p1')
    expect(apiClient.delete).toHaveBeenCalledWith('/players/p1')
  })

  it('useCreateGameSession posts the name', async () => {
    const { result } = renderHook(() => useCreateGameSession(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ name: 'Evening' })
    expect(apiClient.post).toHaveBeenCalledWith('/game-sessions', { name: 'Evening' })
  })

  it('useCreateGameSession posts settings when given', async () => {
    const settings = { budget: 100, lots_count: 5, max_rounds: 10 }
    const { result } = renderHook(() => useCreateGameSession(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ name: 'Evening', settings })
    expect(apiClient.post).toHaveBeenCalledWith('/game-sessions', { name: 'Evening', settings })
  })

  it('useUpdateSessionSettings patches the settings', async () => {
    const settings = { budget: 50, lots_count: 3, max_rounds: 4 }
    const { result } = renderHook(() => useUpdateSessionSettings(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ sessionId: 's1', settings })
    expect(apiClient.patch).toHaveBeenCalledWith('/game-sessions/s1', { settings })
  })

  it('useUpdateSessionStatus patches the status', async () => {
    const { result } = renderHook(() => useUpdateSessionStatus(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ sessionId: 's1', status: 'paused' })
    expect(apiClient.patch).toHaveBeenCalledWith('/game-sessions/s1', { status: 'paused' })
  })

  it('useSessionBids fetches all bids of a session', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [{ lot_number: 1 }] })
    const { result } = renderHook(() => useSessionBids('s1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/game-sessions/s1/bids', { params: undefined })
  })

  it('useSessionBids filters by lot number', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] })
    const { result } = renderHook(() => useSessionBids('s1', 2), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/game-sessions/s1/bids', { params: { lot_number: 2 } })
  })

  it('useSessionBids is disabled without a session', () => {
    renderHook(() => useSessionBids(null), { wrapper: createWrapper() })
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('useAddToRoster posts the player id', async () => {
    const { result } = renderHook(() => useAddToRoster(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ sessionId: 's1', playerId: 'p1' })
    expect(apiClient.post).toHaveBeenCalledWith('/game-sessions/s1/players', { player_id: 'p1' })
  })

  it('useRemoveFromRoster deletes the roster entry', async () => {
    const { result } = renderHook(() => useRemoveFromRoster(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ sessionId: 's1', playerId: 'p1' })
    expect(apiClient.delete).toHaveBeenCalledWith('/game-sessions/s1/players/p1')
  })

  it('useStartGameSession starts the session', async () => {
    const { result } = renderHook(() => useStartGameSession(), { wrapper: createWrapper() })
    await result.current.mutateAsync('s1')
    expect(apiClient.post).toHaveBeenCalledWith('/game-sessions/s1/start')
  })

  it('mutations invalidate players, sessions and prompts', async () => {
    const queryClient = new QueryClient()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useDeletePlayer(), { wrapper })
    await result.current.mutateAsync('p1')
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(3))
    const keys = spy.mock.calls.map((c) => (c[0] as { queryKey: string[] }).queryKey[0])
    expect(keys).toEqual(['players', 'game-sessions', 'prompts'])
  })
})

describe('useGameSessions refetch interval', () => {
  it('polls only while a session is running', async () => {
    vi.mocked(apiClient.get).mockReset().mockResolvedValue({ data: [] })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useGameSessions(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const interval = (client.getQueryCache().find({ queryKey: ['game-sessions'] })!.options as { refetchInterval: unknown }).refetchInterval as (
      q: unknown,
    ) => number | false
    const q = (data: unknown) => ({ state: { data } })
    expect(interval(q([{ status: 'running' }]))).toBe(3000)
    expect(interval(q([{ status: 'paused' }]))).toBe(false)
    expect(interval(q(undefined))).toBe(false)
  })
})
