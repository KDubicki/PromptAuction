import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from './client'
import type { GameSession, PromptStatus, PromptSubmission } from '../types'

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
