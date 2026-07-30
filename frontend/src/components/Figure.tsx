import { Box, Stack, Typography } from '@mui/material'

interface Props {
  label: string
  value: string | number
  /** Trailing unit or denominator, set quieter than the value. */
  suffix?: string
  /** Brass — reserved for the hammer price and winning bids. */
  emphasis?: boolean
}

/**
 * A single labelled figure. All numerals are mono and tabular so a row of
 * these stays aligned as values change.
 */
export function Figure({ label, value, suffix, emphasis = false }: Props) {
  return (
    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Box
        data-figure
        sx={{
          fontFamily: (t) => t.typography.caption.fontFamily,
          fontSize: { xs: '1.125rem', sm: '1.25rem' },
          fontWeight: 500,
          lineHeight: 1.2,
          color: emphasis ? 'primary.main' : 'text.primary',
        }}
      >
        {value}
        {suffix && (
          <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.8em', ml: 0.5 }}>
            {suffix}
          </Box>
        )}
      </Box>
    </Stack>
  )
}
