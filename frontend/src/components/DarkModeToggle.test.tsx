import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DarkModeToggle } from './DarkModeToggle'

describe('DarkModeToggle', () => {
  it('shows the switch-to-dark tooltip label and calls onToggle when clicked (light mode)', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<DarkModeToggle darkMode={false} onToggle={onToggle} />)

    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument()
    await user.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('shows the switch-to-light tooltip label in dark mode', () => {
    render(<DarkModeToggle darkMode={true} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument()
  })
})
