import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LiveGameStateView } from './LiveGameStateView'

describe('LiveGameStateView', () => {
  it('renders the state and current item', () => {
    render(<LiveGameStateView state="running" item="Crystal Fox" />)
    expect(screen.getByText('Live Game State')).toBeInTheDocument()
    expect(screen.getByText('State: running')).toBeInTheDocument()
    expect(screen.getByText('Current Item: Crystal Fox')).toBeInTheDocument()
  })
})
