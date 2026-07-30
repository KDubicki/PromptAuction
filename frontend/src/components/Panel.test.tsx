import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Panel } from './Panel'

describe('Panel', () => {
  it('renders its title and children', () => {
    render(<Panel title="Action arena">Body</Panel>)
    expect(screen.getByRole('heading', { name: 'Action arena' })).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
  })

  it('renders an optional slug and action', () => {
    render(
      <Panel title="Review queue" slug="Lot 04 / 45" action={<button>Initialize</button>}>
        Body
      </Panel>,
    )
    expect(screen.getByText('Lot 04 / 45')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Initialize' })).toBeInTheDocument()
  })

  it('omits the slug when none is given', () => {
    render(<Panel title="Engine">Body</Panel>)
    expect(screen.queryByText(/Lot/)).not.toBeInTheDocument()
  })
})
