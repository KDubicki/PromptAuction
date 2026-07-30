import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatusHeader } from './StatusHeader'

describe('StatusHeader', () => {
  it('renders the round and iteration figures', () => {
    render(<StatusHeader round={2} totalRounds={50} iteration={15} totalIterations={45} />)
    expect(screen.getByRole('heading', { name: 'Live game' })).toBeInTheDocument()
    expect(screen.getByText('Round')).toBeInTheDocument()
    expect(screen.getByText('/ 50')).toBeInTheDocument()
    expect(screen.getByText('Iteration')).toBeInTheDocument()
    expect(screen.getByText('/ 45')).toBeInTheDocument()
  })

  it('reports round progress as a percentage', () => {
    render(<StatusHeader round={2} totalRounds={50} iteration={15} totalIterations={45} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33')
  })

  it('reports zero progress when the round has no iterations', () => {
    render(<StatusHeader round={1} totalRounds={50} iteration={0} totalIterations={0} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
})
