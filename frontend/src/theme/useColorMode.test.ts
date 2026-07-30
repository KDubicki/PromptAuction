import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useColorMode } from './useColorMode'

const KEY = 'promptauction:color-mode'

type ChangeHandler = (event: { matches: boolean }) => void

/** Stubs `matchMedia` and hands back a way to fire an OS theme change. */
function stubSystemPrefersLight(prefersLight: boolean, withListener = true) {
  const handlers: ChangeHandler[] = []
  const query = {
    matches: prefersLight,
    media: '(prefers-color-scheme: light)',
    addEventListener: withListener
      ? (_: string, handler: ChangeHandler) => void handlers.push(handler)
      : undefined,
    removeEventListener: withListener ? vi.fn() : undefined,
  }
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(query))
  return {
    emit: (matches: boolean) => handlers.forEach((handler) => handler({ matches })),
  }
}

describe('useColorMode', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('follows the OS preference when nothing is stored', () => {
    stubSystemPrefersLight(true)
    const { result } = renderHook(() => useColorMode())
    expect(result.current.mode).toBe('light')
  })

  it('falls back to dark when the OS preference is unavailable', () => {
    const { result } = renderHook(() => useColorMode())
    expect(result.current.mode).toBe('dark')
  })

  it('does not persist the OS-derived value', () => {
    stubSystemPrefersLight(true)
    renderHook(() => useColorMode())
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it('keeps following the OS while there is no override', () => {
    const system = stubSystemPrefersLight(false)
    const { result } = renderHook(() => useColorMode())
    expect(result.current.mode).toBe('dark')

    act(() => system.emit(true))
    expect(result.current.mode).toBe('light')
  })

  it('stops following the OS once the operator has chosen', () => {
    const system = stubSystemPrefersLight(false)
    const { result } = renderHook(() => useColorMode())

    act(() => result.current.toggle())
    expect(result.current.mode).toBe('light')

    act(() => system.emit(false))
    expect(result.current.mode).toBe('light')
  })

  it('tolerates a matchMedia without listener support', () => {
    stubSystemPrefersLight(true, false)
    const { result } = renderHook(() => useColorMode())
    expect(result.current.mode).toBe('light')
  })

  it('prefers a stored override over the OS preference', () => {
    stubSystemPrefersLight(true)
    window.localStorage.setItem(KEY, 'dark')
    const { result } = renderHook(() => useColorMode())
    expect(result.current.mode).toBe('dark')
  })

  it('ignores a stored value that is not a colour mode', () => {
    window.localStorage.setItem(KEY, 'sepia')
    const { result } = renderHook(() => useColorMode())
    expect(result.current.mode).toBe('dark')
  })

  it('toggles and persists the choice', () => {
    const { result } = renderHook(() => useColorMode())
    act(() => result.current.toggle())
    expect(result.current.mode).toBe('light')
    expect(window.localStorage.getItem(KEY)).toBe('light')

    act(() => result.current.toggle())
    expect(result.current.mode).toBe('dark')
    expect(window.localStorage.getItem(KEY)).toBe('dark')
  })

  it('still works when storage is blocked', () => {
    const denied = () => {
      throw new Error('denied')
    }
    const original = window.localStorage
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: { ...original, getItem: denied, setItem: denied, clear: () => {} },
    })

    try {
      const { result } = renderHook(() => useColorMode())
      expect(result.current.mode).toBe('dark')
      act(() => result.current.toggle())
      expect(result.current.mode).toBe('light')
    } finally {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: original })
    }
  })
})
