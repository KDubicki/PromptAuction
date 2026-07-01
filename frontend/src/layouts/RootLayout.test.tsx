import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { RootLayout } from './RootLayout'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<div>Game content</div>} />
          <Route path="admin" element={<div>Admin content</div>} />
          <Route path="leaderboard" element={<div>Leaderboard content</div>} />
          <Route path="submit" element={<div>Submit content</div>} />
          <Route path="*" element={<div>Not found content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('RootLayout', () => {
  it('renders the brand link, nav tabs, and outlet content for the index route', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: 'PromptAuction' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Live Game', selected: true })).toBeInTheDocument()
    expect(screen.getByText('Game content')).toBeInTheDocument()
  })

  it('highlights the matching tab for nested routes', () => {
    renderAt('/admin')
    expect(screen.getByRole('tab', { name: 'Admin', selected: true })).toBeInTheDocument()
    expect(screen.getByText('Admin content')).toBeInTheDocument()
  })

  it('selects no tab for unknown routes', () => {
    renderAt('/unknown')
    for (const label of ['Live Game', 'Admin', 'Leaderboard', 'Submit Prompt']) {
      expect(screen.getByRole('tab', { name: label, selected: false })).toBeInTheDocument()
    }
    expect(screen.getByText('Not found content')).toBeInTheDocument()
  })

  it('toggles dark mode when the toggle button is clicked', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const button = screen.getByRole('button', { name: 'Switch to light mode' })
    await user.click(button)
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument()
  })
})
