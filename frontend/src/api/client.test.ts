import { afterEach, describe, expect, it, vi } from 'vitest'

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('defaults to http://localhost:8000/api when VITE_API_BASE_URL is unset', async () => {
    const { apiClient } = await import('./client')
    expect(apiClient.defaults.baseURL).toBe('http://localhost:8000/api')
  })

  it('uses VITE_API_BASE_URL when it is provided', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://example.test/api')
    const { apiClient } = await import('./client')
    expect(apiClient.defaults.baseURL).toBe('https://example.test/api')
  })

  it('sets a 5 second timeout', async () => {
    const { apiClient } = await import('./client')
    expect(apiClient.defaults.timeout).toBe(5000)
  })
})
