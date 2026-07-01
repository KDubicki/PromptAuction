import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatusHeader } from './StatusHeader'

describe('StatusHeader', () => {
  it('renders the round/iteration progress', () => {
    render(<StatusHeader round={2} totalRounds={50} iteration={15} totalIterations={45} />)
    expect(screen.getByText('Live Game Dashboard')).toBeInTheDocument()
    expect(screen.getByText(/Round 2\/50, Iteration 15\/45/)).toBeInTheDocument()
  })
})
