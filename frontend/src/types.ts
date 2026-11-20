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
  latest_version: number
  created_at: string | null
}

export interface PlayerDetail extends Player {
  versions: PromptVersion[]
}

export interface SessionSettings {
  budget: number
  lots_count: number
  max_rounds: number
}

export interface OwnedItem {
  item: string
  quality: number
  required: boolean
  lot_number: number
  price: number
}

export interface RosterEntry {
  player_ref: string
  name: string
  current_version: number | null
  version_id: string | null
  version: number | null
  prompt_text: string | null
  budget: number | null
  items: OwnedItem[]
}

export type GameStatus = 'pending' | 'running' | 'paused' | 'completed'

export type LotStatus = 'pending' | 'sold' | 'unsold'

export interface Lot {
  number: number
  item: string
  quality: number
  required: boolean
  status: LotStatus
  sold_to: string | null
  sold_to_name: string | null
  price: number | null
  sold_in_round: number | null
}

export interface Auction {
  lot_number: number
  current_round: number
  highest_bid: number
  leader_ref: string | null
  leader_name: string | null
  void_rounds: number
}

export interface Standing {
  rank: number
  player_ref: string
  name: string
  unique_required: number
  quality: number
  budget: number
}

export interface SessionBid {
  lot_number: number
  item: string
  round: number
  player_id: string
  player_ref: string | null
  bid: number | null
  reason: string | null
  response_ms: number | null
  outcome: string | null
  won: boolean
  created_at: string | null
}

export interface GameSession {
  id: string
  name: string
  status: GameStatus
  roster: RosterEntry[]
  start_blockers: string[]
  settings: SessionSettings
  required_items: string[]
  lots: Lot[]
  auction: Auction | null
  standings: Standing[]
  pause_reason: string | null
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
