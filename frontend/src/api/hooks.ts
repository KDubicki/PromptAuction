import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

import { apiClient } from './client'
import type {
  GameStatus,
  EntryForm,
  GameSession,
  GoogleFormStatus,
  GoogleFormSyncResult,
  Player,
  PlayerDetail,
  PromptStatus,
  PromptSubmission,
  PromptVersion,
  SessionBid,
  SessionSettings,
} from '../types'

/** The backend's `detail` message when there is one, so admins see what to fix. */
export function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const detail: unknown = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (!error.response) return 'Cannot reach the API server.'
  }
  return 'Something went wrong. Try again.'
}

const fallbackPrompts: PromptSubmission[] = [
  { id: '1', player_id: 'p1', prompt_text: 'I only bid when item is shiny.', status: 'pending' },
  { id: '2', player_id: 'p2', prompt_text: 'Bid aggressively in early rounds.', status: 'accepted' },
]

export function usePrompts(statusFilter?: PromptStatus) {
  return useQuery({
    queryKey: ['prompts', statusFilter],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<PromptSubmission[]>('/prompts', {
          params: statusFilter ? { status_filter: statusFilter } : undefined,
        })
        return data
      } catch {
        return statusFilter ? fallbackPrompts.filter((p) => p.status === statusFilter) : fallbackPrompts
      }
    },
  })
}

export function useUpdatePromptStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PromptStatus }) => {
      await apiClient.patch(`/prompts/${id}/status`, { status })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
      queryClient.invalidateQueries({ queryKey: ['players'] })
      queryClient.invalidateQueries({ queryKey: ['game-sessions'] })
    },
  })
}

const GOOGLE_FORM_KEY = ['google-form'] as const

export function useGoogleFormStatus() {
  return useQuery({
    queryKey: GOOGLE_FORM_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<GoogleFormStatus>('/admin/google-form')
      return data
    },
    refetchInterval: 15_000,
  })
}

function useGoogleFormMutation<TVariables, TResult>(request: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: GOOGLE_FORM_KEY })
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
      queryClient.invalidateQueries({ queryKey: ['entry-form'] })
      queryClient.invalidateQueries({ queryKey: ['players'] })
      queryClient.invalidateQueries({ queryKey: ['game-sessions'] })
    },
  })
}

export function useConnectGoogleForm() {
  return useGoogleFormMutation(async (url: string) => {
    const { data } = await apiClient.put<GoogleFormStatus>('/admin/google-form', { url })
    return data
  })
}

export function useSyncGoogleForm() {
  return useGoogleFormMutation(async () => {
    const { data } = await apiClient.post<GoogleFormSyncResult>('/admin/google-form/sync')
    return data
  })
}

export function useDisconnectGoogleForm() {
  return useGoogleFormMutation(async () => {
    await apiClient.delete('/admin/google-form')
  })
}

/** The connected form's public link for players, or null when none is connected. */
export function useEntryForm() {
  return useQuery({
    queryKey: ['entry-form'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<EntryForm>('/entry-form')
        return data
      } catch {
        return null
      }
    },
  })
}

export function useGameSessions() {
  return useQuery({
    queryKey: ['game-sessions'],
    queryFn: async () => {
      const { data } = await apiClient.get<GameSession[]>('/game-sessions')
      return data
    },
    refetchInterval: (query) => (query.state.data?.some((s) => s.status === 'running') ? 3000 : false),
  })
}

function useRosterMutation<TVariables, TResult>(request: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
      queryClient.invalidateQueries({ queryKey: ['game-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
    },
  })
}

export function usePlayers() {
  return useQuery({
    queryKey: ['players'],
    queryFn: async () => {
      const { data } = await apiClient.get<Player[]>('/players')
      return data
    },
  })
}

export function usePlayer(id: string | null) {
  return useQuery({
    queryKey: ['players', id],
    enabled: id !== null,
    queryFn: async () => {
      const { data } = await apiClient.get<PlayerDetail>(`/players/${id}`)
      return data
    },
  })
}

export function useCreatePlayer() {
  return useRosterMutation(async (body: { name: string; email?: string; prompt_text: string }) => {
    const { data } = await apiClient.post<Player>('/players', body)
    return data
  })
}

export function useUpdatePlayer() {
  return useRosterMutation(async ({ id, ...body }: { id: string; name?: string; email?: string }) => {
    const { data } = await apiClient.patch<Player>(`/players/${id}`, body)
    return data
  })
}

export function useAddPromptVersion() {
  return useRosterMutation(async ({ id, prompt_text }: { id: string; prompt_text: string }) => {
    const { data } = await apiClient.post<PromptVersion>(`/players/${id}/versions`, { prompt_text })
    return data
  })
}

export function useDeletePlayer() {
  return useRosterMutation(async (id: string) => {
    await apiClient.delete(`/players/${id}`)
  })
}

export function useCreateGameSession() {
  return useRosterMutation(async (body: { name: string; settings?: SessionSettings }) => {
    const { data } = await apiClient.post<GameSession>('/game-sessions', body)
    return data
  })
}

export function useUpdateSessionSettings() {
  return useRosterMutation(async ({ sessionId, settings }: { sessionId: string; settings: SessionSettings }) => {
    const { data } = await apiClient.patch<GameSession>(`/game-sessions/${sessionId}`, { settings })
    return data
  })
}

export function useUpdateSessionStatus() {
  return useRosterMutation(async ({ sessionId, status }: { sessionId: string; status: GameStatus }) => {
    const { data } = await apiClient.patch<GameSession>(`/game-sessions/${sessionId}`, { status })
    return data
  })
}

export function useSessionBids(sessionId: string | null, lotNumber?: number, live = false) {
  return useQuery({
    queryKey: ['session-bids', sessionId, lotNumber],
    enabled: sessionId !== null,
    refetchInterval: live ? 3000 : false,
    queryFn: async () => {
      const { data } = await apiClient.get<SessionBid[]>(`/game-sessions/${sessionId}/bids`, {
        params: lotNumber === undefined ? undefined : { lot_number: lotNumber },
      })
      return data
    },
  })
}

export function useAddToRoster() {
  return useRosterMutation(async ({ sessionId, playerId }: { sessionId: string; playerId: string }) => {
    const { data } = await apiClient.post<GameSession>(`/game-sessions/${sessionId}/players`, { player_id: playerId })
    return data
  })
}

export function useRemoveFromRoster() {
  return useRosterMutation(async ({ sessionId, playerId }: { sessionId: string; playerId: string }) => {
    await apiClient.delete(`/game-sessions/${sessionId}/players/${playerId}`)
  })
}

export function useStartGameSession() {
  return useRosterMutation(async (sessionId: string) => {
    const { data } = await apiClient.post<GameSession>(`/game-sessions/${sessionId}/start`)
    return data
  })
}
