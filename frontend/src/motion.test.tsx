import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { fadeUp, growUp, ripple, useCountUp } from './motion'

function Counter({ value, from }: { value: number; from?: number }) {
  return <span>{useCountUp(value, { durationMs: 100, from })}</span>
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useCountUp', () => {
  it('shows the target at once and counts to new targets', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', undefined)
    vi.stubGlobal('cancelAnimationFrame', undefined)
    const { rerender } = render(<Counter value={10} />)
    expect(screen.getByText('10')).toBeInTheDocument()

    rerender(<Counter value={110} />)
    act(() => {
      vi.advanceTimersByTime(48)
    })
    const mid = Number(screen.getByText(/\d+/).textContent)
    expect(mid).toBeGreaterThan(10)
    expect(mid).toBeLessThan(110)

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.getByText('110')).toBeInTheDocument()
  })

  it('counts up from a starting value on mount, using animation frames', async () => {
    let now = 0
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => setTimeout(() => cb((now += 50)), 0) as unknown as number)
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
    render(<Counter value={40} from={0} />)
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(await screen.findByText('40')).toBeInTheDocument()
  })

  it('jumps straight to the target when motion is reduced', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }))
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => setTimeout(() => cb(0), 0) as unknown as number)
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
    render(<Counter value={7} from={0} />)
    expect(await screen.findByText('7')).toBeInTheDocument()
  })

  it('stops counting when unmounted', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', undefined)
    vi.stubGlobal('cancelAnimationFrame', undefined)
    const { unmount } = render(<Counter value={5} from={0} />)
    unmount()
    act(() => {
      vi.advanceTimersByTime(500)
    })
  })
})

describe('motion styles', () => {
  it('builds keyframed styles', () => {
    expect(fadeUp(120).animation).toContain('120ms')
    expect(growUp().transformOrigin).toBe('bottom')
    expect(ripple('red')['@keyframes ripple'].from.boxShadow).toContain('red')
  })
})
