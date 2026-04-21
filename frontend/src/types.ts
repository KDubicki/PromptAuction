export type PromptStatus = 'pending' | 'accepted' | 'rejected'

export interface PromptSubmission {
  id: string
  player_id: string
  prompt_text: string
  status: PromptStatus
}

export interface PlayerBid {
  player_id: string
  item_name: string
  bid_amount: number
  won: boolean
}

export interface GameSession {
  id: string
  name: string
  status: string
  current_round: number
  current_iteration: number
}

export interface LeaderboardEntry {
  playerId: string
  winRate: number
  items: string[]
}
