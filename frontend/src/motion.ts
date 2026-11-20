import { useEffect, useRef, useState } from 'react'

const EASE_OUT = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

/** Rises into place. `both` keeps it hidden until its delay ends; reduced motion skips straight to the end. */
export function fadeUp(delayMs = 0, distance = 8) {
  return {
    animation: `fadeUp 420ms ${EASE_OUT} ${delayMs}ms both`,
    '@keyframes fadeUp': {
      from: { opacity: 0, transform: `translateY(${distance}px)` },
      to: { opacity: 1, transform: 'none' },
    },
  }
}

/** Grows up from its baseline, for bars. */
export function growUp(delayMs = 0) {
  return {
    transformOrigin: 'bottom',
    animation: `growUp 650ms ${EASE_OUT} ${delayMs}ms both`,
    '@keyframes growUp': { from: { transform: 'scaleY(0)' }, to: { transform: 'scaleY(1)' } },
  }
}

/** One ring that spreads out from an element, for a change worth noticing. */
export function ripple(color: string) {
  return {
    animation: 'ripple 900ms ease-out 1',
    '@keyframes ripple': {
      from: { boxShadow: `0 0 0 0 ${color}` },
      to: { boxShadow: '0 0 0 14px transparent' },
    },
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

const frame = (cb: (now: number) => void): number =>
  typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(cb)
    : (setTimeout(() => cb(Date.now()), 16) as unknown as number)

const cancelFrame = (id: number) =>
  typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : clearTimeout(id)

/**
 * A number that counts to its target instead of jumping. Starts at `from`
 * (defaults to the target, so only changes animate).
 */
export function useCountUp(target: number, { durationMs = 600, from }: { durationMs?: number; from?: number } = {}): number {
  const [shown, setShown] = useState(from ?? target)
  const current = useRef(from ?? target)

  useEffect(() => {
    const start = current.current
    if (start === target) return
    const duration = prefersReducedMotion() ? 0 : durationMs
    let began: number | null = null
    let id = 0
    const tick = (now: number) => {
      began ??= now
      const t = duration === 0 ? 1 : Math.min(1, (now - began) / duration)
      const value = Math.round(start + (target - start) * (1 - (1 - t) ** 3))
      current.current = value
      setShown(value)
      if (t < 1) id = frame(tick)
    }
    id = frame(tick)
    return () => cancelFrame(id)
  }, [target, durationMs])

  return shown
}
