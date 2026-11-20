import type { SessionSettings } from '../types'

export interface SettingsDraft {
  budget: string
  lots_count: string
  max_rounds: string
}

export interface FieldSpec {
  key: keyof SettingsDraft
  label: string
  min: number
  max: number
}

export const FIELDS: FieldSpec[] = [
  { key: 'budget', label: 'Budget', min: 1, max: 1_000_000 },
  { key: 'lots_count', label: 'Items', min: 1, max: 500 },
  { key: 'max_rounds', label: 'Rounds per item', min: 1, max: 100 },
]

export const DEFAULT_SETTINGS: SessionSettings = { budget: 1000, lots_count: 12, max_rounds: 10 }

export function toDraft(settings: SessionSettings): SettingsDraft {
  return {
    budget: String(settings.budget),
    lots_count: String(settings.lots_count),
    max_rounds: String(settings.max_rounds),
  }
}

export function inRange(value: string, field: FieldSpec): boolean {
  const n = Number(value)
  return value.trim() !== '' && Number.isInteger(n) && n >= field.min && n <= field.max
}

/** The draft as settings, or null while any field is empty, fractional or out of range. */
export function parseDraft(draft: SettingsDraft): SessionSettings | null {
  if (!FIELDS.every((field) => inRange(draft[field.key], field))) return null
  return {
    budget: Number(draft.budget),
    lots_count: Number(draft.lots_count),
    max_rounds: Number(draft.max_rounds),
  }
}
