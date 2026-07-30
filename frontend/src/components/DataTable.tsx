import type { ReactNode } from 'react'
import {
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'

export interface Column<T> {
  key: string
  header: string
  align?: 'left' | 'right'
  /** Renders as mono tabular figures — use for anything numeric. */
  figure?: boolean
  render: (row: T) => ReactNode
}

interface Props<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string
  emptyMessage?: string
}

/**
 * A table that becomes a stack of labelled cards below `sm`. Horizontal
 * scrolling hides data on a phone; stacking keeps every field readable.
 */
export function DataTable<T>({ columns, rows, rowKey, emptyMessage = 'No records yet.' }: Props<T>) {
  const theme = useTheme()
  const stacked = useMediaQuery(theme.breakpoints.down('sm'))

  if (rows.length === 0) {
    return (
      <Typography sx={{ color: 'text.secondary', px: { xs: 2, sm: 2.5 }, py: 3 }}>
        {emptyMessage}
      </Typography>
    )
  }

  if (stacked) {
    return (
      <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {rows.map((row, index) => (
          <Stack
            key={rowKey(row, index)}
            component="li"
            spacing={1}
            sx={{
              px: 2,
              py: 1.75,
              borderBottom: index < rows.length - 1 ? 1 : 0,
              borderColor: 'divider',
            }}
          >
            {columns.map((column) => (
              <Stack
                key={column.key}
                direction="row"
                sx={{ gap: 2, alignItems: 'baseline', justifyContent: 'space-between' }}
              >
                <Typography variant="overline" sx={{ color: 'text.secondary', flexShrink: 0 }}>
                  {column.header}
                </Typography>
                <Box
                  data-figure={column.figure ? '' : undefined}
                  sx={{
                    textAlign: 'right',
                    minWidth: 0,
                    fontFamily: column.figure ? (t) => t.typography.caption.fontFamily : undefined,
                    fontSize: '0.875rem',
                  }}
                >
                  {column.render(row)}
                </Box>
              </Stack>
            ))}
          </Stack>
        ))}
      </Stack>
    )
  }

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell key={column.key} align={column.align ?? 'left'}>
                {column.header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={rowKey(row, index)} hover>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  align={column.align ?? 'left'}
                  data-figure={column.figure ? '' : undefined}
                  sx={{
                    fontFamily: column.figure ? (t) => t.typography.caption.fontFamily : undefined,
                    whiteSpace: column.figure ? 'nowrap' : undefined,
                  }}
                >
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  )
}
