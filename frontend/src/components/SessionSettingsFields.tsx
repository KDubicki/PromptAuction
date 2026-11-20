import { Stack, TextField } from '@mui/material'

import { FIELDS, formatRange, inRange, type SettingsDraft } from './sessionSettings'

interface Props {
  draft: SettingsDraft
  onChange: (draft: SettingsDraft) => void
  disabled?: boolean
}

export function SessionSettingsFields({ draft, onChange, disabled = false }: Props) {
  return (
    <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
      {FIELDS.map((field) => (
        <TextField
          key={field.key}
          size="small"
          type="number"
          label={field.label}
          disabled={disabled}
          value={draft[field.key]}
          error={!inRange(draft[field.key], field)}
          helperText={inRange(draft[field.key], field) ? undefined : formatRange(field)}
          onChange={(event) => onChange({ ...draft, [field.key]: event.target.value })}
          slotProps={{
            htmlInput: { 'aria-label': field.label, min: field.min, max: field.max, step: 1, 'data-figure': '' },
          }}
          sx={{ flex: '1 1 7rem', minWidth: 0 }}
        />
      ))}
    </Stack>
  )
}
