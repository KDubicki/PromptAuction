import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LiveIndicator } from './LiveIndicator'

describe('LiveIndicator', () => {
  it('reads Live when the engine is running', () => {
    render(<LiveIndicator live />)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('reads Idle when the engine is stopped', () => {
    render(<LiveIndicator live={false} />)
    expect(screen.getByText('Idle')).toBeInTheDocument()
  })
})
