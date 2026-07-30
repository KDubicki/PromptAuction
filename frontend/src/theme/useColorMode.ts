import { useCallback, useEffect, useState } from 'react'

import type { ColorMode } from './tokens'

const STORAGE_KEY = 'promptauction:color-mode'
const LIGHT_QUERY = '(prefers-color-scheme: light)'

function readStored(): ColorMode | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

function systemMode(): ColorMode {
  return window.matchMedia?.(LIGHT_QUERY)?.matches ? 'light' : 'dark'
}

/**
 * Colour mode that follows the OS until the operator overrides it.
 *
 * Only an explicit toggle is persisted — storing the OS-derived value would
 * pin the app to whatever the system happened to be on the first visit.
 */
export function useColorMode() {
  const [override, setOverride] = useState<ColorMode | null>(readStored)
  const [system, setSystem] = useState<ColorMode>(systemMode)

  useEffect(() => {
    const query = window.matchMedia?.(LIGHT_QUERY)
    if (!query?.addEventListener) return

    const onChange = (event: MediaQueryListEvent) => setSystem(event.matches ? 'light' : 'dark')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const mode = override ?? system

  const toggle = useCallback(() => {
    const next: ColorMode = mode === 'dark' ? 'light' : 'dark'
    setOverride(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private browsing — the session still works, it just won't persist.
    }
  }, [mode])

  return { mode, toggle }
}
