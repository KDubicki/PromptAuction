import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

import '@testing-library/jest-dom/vitest'

// Node 25 installs its own `localStorage` global that shadows jsdom's, and
// without `--localstorage-file` it is a plain object with no Storage methods.
// Swap in a working in-memory store so persistence behaves as it does in a
// browser.
if (typeof window.localStorage?.clear !== 'function') {
  const store = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size
      },
    } satisfies Storage,
  })
}

afterEach(() => {
  cleanup()
  // The colour mode persists to storage, so clear it between tests.
  window.localStorage.clear()
})
