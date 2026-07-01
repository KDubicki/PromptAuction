import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App', () => {
  it('renders the router with the GamePage at the default route', () => {
    render(<App />)
    expect(screen.getByRole('link', { name: 'PromptAuction' })).toBeInTheDocument()
    expect(screen.getByText('Live Game Dashboard')).toBeInTheDocument()
  })
})
