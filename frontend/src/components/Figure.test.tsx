import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Figure } from './Figure'

describe('Figure', () => {
  it('renders a label and value', () => {
    render(<Figure label="Round" value={2} />)
    expect(screen.getByText('Round')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders an optional suffix', () => {
    render(<Figure label="Round" value={2} suffix="/ 50" />)
    expect(screen.getByText('/ 50')).toBeInTheDocument()
  })

  it('renders without a suffix when none is given', () => {
    render(<Figure label="Lot" value="Crystal Fox" emphasis />)
    expect(screen.getByText('Crystal Fox')).toBeInTheDocument()
  })
})
