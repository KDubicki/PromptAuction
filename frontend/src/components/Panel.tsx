import type { ReactNode } from 'react'
import { Box, Card, Stack, Typography } from '@mui/material'

interface Props {
  title: string
  /** Mono corner slug — a count or position, e.g. "3 waiting". */
  slug?: string
  action?: ReactNode
  children: ReactNode
  /** Removes body padding for panels whose child manages its own edges. */
  flush?: boolean
}

/**
 * The shared console surface. The title names the panel; the slug sits quietly
 * in the corner so the title stays the first thing read.
 */
export function Panel({ title, slug, action, children, flush = false }: Props) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          gap: 2,
          px: { xs: 2, sm: 2.5 },
          minHeight: 56,
          py: 1.25,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" component="h2" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
          {title}
        </Typography>
        {slug && (
          <Typography
            variant="overline"
            data-figure
            sx={{ color: 'text.secondary', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            {slug}
          </Typography>
        )}
        {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
      </Stack>

      <Box sx={{ flex: 1, p: flush ? 0 : { xs: 2, sm: 2.5 } }}>{children}</Box>
    </Card>
  )
}
