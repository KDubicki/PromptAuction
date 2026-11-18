export type PromptStatus = 'pending' | 'accepted' | 'rejected'

export type PromptSource = 'admin' | 'google_forms' | 'webhook' | 'migration'

export interface PromptSubmission {
  id: string
  player_id: string
  prompt_text: string
  status: PromptStatus
  player_ref?: string | null
  version?: number | null
  source?: PromptSource | null
  identity_warning?: string | null
  email?: string | null
}

export interface PromptVersion {
  id: string
  version: number
  prompt_text: string
  status: PromptStatus
  source: PromptSource
  player_name: string
  identity_warning: string | null
  email: string | null
  created_at: string | null
}

export interface Player {
  id: string
  name: string
  email: string | null
  current_version: PromptVersion | null
  pending_versions: number
  created_at: string | null
}

export interface PlayerDetail extends Player {
  versions: PromptVersion[]
}

export interface RosterEntry {
  player_ref: string
  name: string
  current_version: number | null
  version_id: string | null
  version: number | null
  prompt_text: string | null
}

export interface PlayerBid {
  player_id: string
  item_name: string
  bid_amount: number
  won: boolean
}

export type GameStatus = 'pending' | 'running' | 'paused' | 'completed'

export interface GameSession {
  id: string
  name: string
  status: GameStatus
  roster: RosterEntry[]
  start_blockers: string[]
  current_round: number
  current_iteration: number
  started_at: string | null
  created_at?: string | null
  updated_at?: string | null
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
