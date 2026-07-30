import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RootLayout } from './RootLayout'

/** Forces MUI's `useMediaQuery` to report a match, standing in for a wide viewport. */
function stubWideViewport() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: true,
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

const NAV_LABELS = ['Live game', 'Admin', 'Leaderboard', 'Submit prompt']

describe('RootLayout', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the brand link and outlet content', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: 'PromptAuction' })).toBeInTheDocument()
    expect(screen.getByText('Game content')).toBeInTheDocument()
  })

  it('offers a skip link to the main content', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
  })

  describe('at wide viewports', () => {
    it('shows a permanent drawer with no hamburger', () => {
      stubWideViewport()
      renderAt('/')
      expect(screen.queryByRole('button', { name: 'Open navigation' })).not.toBeInTheDocument()
      for (const label of NAV_LABELS) {
        expect(screen.getByRole('link', { name: label })).toBeVisible()
      }
    })

    it('marks the nav item for the index route', () => {
      stubWideViewport()
      renderAt('/')
      expect(screen.getByRole('link', { name: 'Live game' })).toHaveClass('Mui-selected')
    })

    it('marks the matching nav item for nested routes', () => {
      stubWideViewport()
      renderAt('/admin')
      expect(screen.getByRole('link', { name: 'Admin' })).toHaveClass('Mui-selected')
      expect(screen.getByRole('link', { name: 'Live game' })).not.toHaveClass('Mui-selected')
    })

    it('marks nothing for unknown routes', () => {
      stubWideViewport()
      renderAt('/unknown')
      for (const label of NAV_LABELS) {
        expect(screen.getByRole('link', { name: label })).not.toHaveClass('Mui-selected')
      }
      expect(screen.getByText('Not found content')).toBeInTheDocument()
    })
  })

  describe('at narrow viewports', () => {
    it('keeps the navigation behind a hamburger until it is opened', async () => {
      const user = userEvent.setup()
      renderAt('/')

      expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Open navigation' }))
      expect(screen.getByRole('link', { name: 'Admin' })).toBeVisible()
    })

    it('navigates and closes the drawer when a nav link is followed', async () => {
      const user = userEvent.setup()
      renderAt('/')

      await user.click(screen.getByRole('button', { name: 'Open navigation' }))
      await user.click(screen.getByRole('link', { name: 'Admin' }))

      expect(screen.getByText('Admin content')).toBeInTheDocument()
    })
  })

  it('toggles the colour mode and remembers the choice', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument()
    expect(window.localStorage.getItem('promptauction:color-mode')).toBe('light')
  })
})
