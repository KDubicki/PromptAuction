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

export interface GoogleFormSource {
  form_id: string
  title: string
  edit_url: string
  responder_url: string | null
  connected_at: string | null
  last_synced_at: string | null
  last_error: string | null
  imported_count: number
  skipped_count: number
  mapping: { player_id: string | null; prompt_text: string | null; email: string | null }
}

export interface GoogleFormStatus {
  credentials_configured: boolean
  credentials_error: string | null
  service_account_email: string | null
  poll_interval_seconds: number
  form: GoogleFormSource | null
}

export interface GoogleFormSyncResult {
  imported: number
  skipped: number
}

export interface EntryForm {
  title: string
  responder_url: string
}

export interface LeaderboardEntry {
  playerId: string
  winRate: number
  items: string[]
}
