import { Box } from '@mui/material'

import { DataTable, type Column } from './DataTable'
import { Panel } from './Panel'
import { pluralize } from '../plural'
import type { GameSession, Standing } from '../types'

const columns: Column<Standing>[] = [
  {
    key: 'rank',
    header: 'Rank',
    figure: true,
    render: (row) => (
      <Box component="span" sx={{ color: row.rank === 1 ? 'primary.main' : 'text.primary', fontWeight: 600 }}>
        {row.rank}
      </Box>
    ),
  },
  { key: 'player', header: 'Player', render: (row) => row.name },
  { key: 'required', header: 'Required items', align: 'right', figure: true, render: (row) => row.unique_required },
  { key: 'quality', header: 'Quality', align: 'right', figure: true, render: (row) => row.quality },
  { key: 'budget', header: 'Budget', align: 'right', figure: true, render: (row) => row.budget },
]

export function SessionStandings({ session }: { session: GameSession }) {
  return (
    <Panel title="Standings" slug={pluralize(session.standings.length, 'player')} flush>
      <DataTable columns={columns} rows={session.standings} rowKey={(row) => row.player_ref} />
    </Panel>
  )
}
