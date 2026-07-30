import type { ReactNode } from 'react'
import { Box, Card, Stack, Typography } from '@mui/material'

interface Props {
  title: string
  /** Mono corner slug — position in the run, e.g. "LOT 04 / 45". */
  slug?: string
  action?: ReactNode
  children: ReactNode
  /** Removes body padding for panels whose child manages its own edges. */
  flush?: boolean
}

/**
 * The shared console surface. Every panel states what it is, and optionally
 * where it sits in the run, before showing data.
 */
export function Panel({ title, slug, action, children, flush = false }: Props) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: { xs: 2, sm: 2.5 },
          py: 1.75,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Stack sx={{ minWidth: 0 }}>
          {slug && (
            <Typography variant="overline" sx={{ color: 'text.secondary' }} data-figure>
              {slug}
            </Typography>
          )}
          <Typography variant="h6" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            {title}
          </Typography>
        </Stack>
        {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
      </Stack>

      <Box sx={{ flex: 1, p: flush ? 0 : { xs: 2, sm: 2.5 } }}>{children}</Box>
    </Card>
  )
}
