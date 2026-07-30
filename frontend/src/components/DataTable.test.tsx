import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DataTable, type Column } from './DataTable'

interface Row {
  player: string
  bid: number
}

const columns: Column<Row>[] = [
  { key: 'player', header: 'Agent', render: (row) => row.player },
  { key: 'bid', header: 'Bid', align: 'right', figure: true, render: (row) => row.bid },
]

const rows: Row[] = [
  { player: 'p1', bid: 31 },
  { player: 'p2', bid: 29 },
]

/** Forces MUI's `useMediaQuery` to report a match, standing in for a narrow viewport. */
function stubNarrowViewport(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

describe('DataTable', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders a table with a header row at wide viewports', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(row) => row.player} />)
    const table = screen.getByRole('table')
    expect(within(table).getByText('Agent')).toBeInTheDocument()
    expect(within(table).getByText('p1')).toBeInTheDocument()
    expect(within(table).getByText('31')).toBeInTheDocument()
  })

  it('collapses to labelled cards below the sm breakpoint', () => {
    stubNarrowViewport(true)
    render(<DataTable columns={columns} rows={rows} rowKey={(row) => row.player} />)

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    // Each field keeps its label instead of scrolling out of view.
    expect(within(items[0]).getByText('Agent')).toBeInTheDocument()
    expect(within(items[0]).getByText('p1')).toBeInTheDocument()
    expect(within(items[0]).getByText('Bid')).toBeInTheDocument()
    expect(within(items[0]).getByText('31')).toBeInTheDocument()
  })

  it('shows the empty message when there are no rows', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        rowKey={(row) => row.player}
        emptyMessage="No bids recorded yet."
      />,
    )
    expect(screen.getByText('No bids recorded yet.')).toBeInTheDocument()
  })

  it('falls back to a default empty message', () => {
    render(<DataTable columns={columns} rows={[]} rowKey={(row) => row.player} />)
    expect(screen.getByText('No records yet.')).toBeInTheDocument()
  })
})
