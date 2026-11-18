import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

import { apiClient } from './client'
import type {
  EntryForm,
  GameSession,
  GoogleFormStatus,
  GoogleFormSyncResult,
  PromptStatus,
  PromptSubmission,
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

const fallbackSessions: GameSession[] = [
  { id: '1', name: 'Evening Match', status: 'running', current_round: 2, current_iteration: 15 },
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
      try {
        const { data } = await apiClient.get<GameSession[]>('/game-sessions')
        return data
      } catch {
        return fallbackSessions
      }
    },
  })
}
