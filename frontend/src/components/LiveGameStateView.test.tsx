import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LiveGameStateView } from './LiveGameStateView'

describe('LiveGameStateView', () => {
  it('renders the state and current item', () => {
    render(<LiveGameStateView state="running" item="Crystal Fox" />)
    expect(screen.getByText('Engine')).toBeInTheDocument()
    expect(screen.getByText('running')).toBeInTheDocument()
    expect(screen.getByText('Crystal Fox')).toBeInTheDocument()
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('reports the engine as idle when it is not running', () => {
    render(<LiveGameStateView state="paused" item="Nebula Coin" />)
    expect(screen.getByText('Idle')).toBeInTheDocument()
  })
})
