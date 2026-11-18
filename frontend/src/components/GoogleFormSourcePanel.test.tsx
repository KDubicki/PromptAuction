import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GoogleFormSourcePanel } from './GoogleFormSourcePanel'
import * as hooks from '../api/hooks'
import type { GoogleFormSource, GoogleFormStatus } from '../types'

vi.mock('../api/hooks', () => ({
  apiErrorMessage: vi.fn((error: unknown) => `msg:${String(error)}`),
  useGoogleFormStatus: vi.fn(),
  useConnectGoogleForm: vi.fn(),
  useSyncGoogleForm: vi.fn(),
  useDisconnectGoogleForm: vi.fn(),
}))

const EMAIL = 'promptauction@project.iam.gserviceaccount.com'

function makeForm(overrides: Partial<GoogleFormSource> = {}): GoogleFormSource {
  return {
    form_id: 'abc',
    title: 'Evening entries',
    edit_url: 'https://docs.google.com/forms/d/abc/edit',
    responder_url: 'https://docs.google.com/forms/d/e/pub/viewform',
    connected_at: '2026-11-18T10:00:00Z',
    last_synced_at: '2026-11-18T10:05:00Z',
    last_error: null,
    imported_count: 7,
    skipped_count: 0,
    mapping: { player_id: 'Nick gracza', prompt_text: 'Prompt', email: null },
    ...overrides,
  }
}

function makeStatus(overrides: Partial<GoogleFormStatus> = {}): GoogleFormStatus {
  return {
    credentials_configured: true,
    credentials_error: null,
    service_account_email: EMAIL,
    poll_interval_seconds: 30,
    form: null,
    ...overrides,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

function mockStatus(result: Record<string, unknown>) {
  vi.mocked(hooks.useGoogleFormStatus).mockReturnValue(result as Any)
}

function mutation(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), isPending: false, isError: false, isSuccess: false, ...overrides } as Any
}

describe('GoogleFormSourcePanel', () => {
  let connect: Any
  let sync: Any
  let disconnect: Any

  beforeEach(() => {
    connect = mutation()
    sync = mutation()
    disconnect = mutation()
    vi.mocked(hooks.useConnectGoogleForm).mockImplementation(() => connect)
    vi.mocked(hooks.useSyncGoogleForm).mockImplementation(() => sync)
    vi.mocked(hooks.useDisconnectGoogleForm).mockImplementation(() => disconnect)
  })

  it('shows a loading state', () => {
    mockStatus({ isLoading: true })
    render(<GoogleFormSourcePanel />)
    expect(screen.getByText('Checking the form connection…')).toBeInTheDocument()
  })

  it('shows the API error when the status cannot be loaded', () => {
    mockStatus({ isError: true, error: 'down' })
    render(<GoogleFormSourcePanel />)
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
    expect(screen.getByText('msg:down')).toBeInTheDocument()
  })

  it('points to the setup guide when the server has no service account', () => {
    mockStatus({ data: makeStatus({ credentials_configured: false, credentials_error: 'No key.' }) })
    render(<GoogleFormSourcePanel />)
    expect(screen.getByText('Setup needed')).toBeInTheDocument()
    expect(screen.getByText(/No key\./)).toBeInTheDocument()
    expect(screen.getByText('docs/google-forms-setup.md')).toBeInTheDocument()
  })

  it('lets the admin copy the service account and connect a form', async () => {
    const user = userEvent.setup()
    mockStatus({ data: makeStatus() })
    render(<GoogleFormSourcePanel />)

    expect(screen.getByText('Not connected')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(await navigator.clipboard.readText()).toBe(EMAIL)
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()

    const connectButton = screen.getByRole('button', { name: 'Connect' })
    expect(connectButton).toBeDisabled()
    await user.type(screen.getByLabelText('Form editor link'), '  https://docs.google.com/forms/d/abc/edit ')
    await user.click(connectButton)
    expect(connect.mutate).toHaveBeenCalledWith('https://docs.google.com/forms/d/abc/edit')

    await user.type(screen.getByLabelText('Form editor link'), '{Enter}')
    expect(connect.mutate).toHaveBeenCalledTimes(2)
  })

  it('keeps the Copy label when the clipboard is unavailable', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'))
    mockStatus({ data: makeStatus() })
    render(<GoogleFormSourcePanel />)
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })

  it('ignores Enter on an empty link and shows connect progress and errors', async () => {
    const user = userEvent.setup()
    connect = mutation({ isPending: true, isError: true, error: 'nope' })
    mockStatus({ data: makeStatus({ service_account_email: null }) })
    render(<GoogleFormSourcePanel />)

    expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Form editor link'), '{Enter}')
    expect(connect.mutate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Connecting…' })).toBeDisabled()
    expect(screen.getByText('msg:nope')).toBeInTheDocument()
  })

  it('shows the connected form with stats, and syncs or disconnects on demand', async () => {
    const user = userEvent.setup()
    mockStatus({ data: makeStatus({ form: makeForm() }) })
    render(<GoogleFormSourcePanel />)

    expect(screen.getByText('Connected · every 30s')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Evening entries' })).toHaveAttribute(
      'href',
      'https://docs.google.com/forms/d/abc/edit',
    )
    expect(screen.getByText('Reading nick ← “Nick gracza” · prompt ← “Prompt”')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.queryByText(/Skipped responses are missing/)).not.toBeInTheDocument()
    expect(screen.getByText(EMAIL)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sync now' }))
    expect(sync.mutate).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Disconnect' }))
    expect(disconnect.mutate).toHaveBeenCalled()
  })

  it('surfaces skipped responses, sync errors and results', () => {
    sync = mutation({ isSuccess: true, data: { imported: 2, skipped: 1 }, isError: true, error: 'sync-x' })
    disconnect = mutation({ isError: true, error: 'disc-x' })
    mockStatus({
      data: makeStatus({
        service_account_email: null,
        form: makeForm({ skipped_count: 1, last_error: 'No access to this form.', last_synced_at: null }),
      }),
    })
    render(<GoogleFormSourcePanel />)

    expect(screen.getByText('never')).toBeInTheDocument()
    expect(screen.getByText(/Skipped responses are missing/)).toBeInTheDocument()
    expect(screen.getByText('No access to this form.')).toBeInTheDocument()
    expect(screen.getByText('Imported 2 new prompt(s).')).toBeInTheDocument()
    expect(screen.getByText('msg:sync-x')).toBeInTheDocument()
    expect(screen.getByText('msg:disc-x')).toBeInTheDocument()
  })

  it('says when a manual sync found nothing new and disables buttons while busy', () => {
    sync = mutation({ isSuccess: true, isPending: true, data: { imported: 0, skipped: 0 } })
    mockStatus({ data: makeStatus({ form: makeForm() }) })
    render(<GoogleFormSourcePanel />)

    expect(screen.getByText('No new responses.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Syncing…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeDisabled()
  })
})
