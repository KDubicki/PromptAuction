import { useState } from 'react'
import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material'

import { Figure } from './Figure'
import { Panel } from './Panel'
import {
  apiErrorMessage,
  useConnectGoogleForm,
  useDisconnectGoogleForm,
  useGoogleFormStatus,
  useSyncGoogleForm,
} from '../api/hooks'
import type { GoogleFormSource } from '../types'

const SETUP_DOC = 'docs/google-forms-setup.md'

function ServiceAccountEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
      <Box
        component="code"
        sx={{
          flex: 1,
          minWidth: 0,
          overflowWrap: 'anywhere',
          px: 1.5,
          py: 1,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          fontSize: '0.875rem',
        }}
      >
        {email}
      </Box>
      <Button variant="outlined" size="small" onClick={copy} sx={{ flexShrink: 0 }}>
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </Stack>
  )
}

function ConnectForm({ email }: { email: string | null }) {
  const [url, setUrl] = useState('')
  const connect = useConnectGoogleForm()

  const submit = () => {
    if (url.trim()) connect.mutate(url.trim())
  }

  return (
    <Stack spacing={2.5}>
      {email && (
        <Stack spacing={1}>
          <Typography variant="body2">
            1. In the form editor, open <strong>⋮ → Add collaborators</strong> and add this address as an
            editor:
          </Typography>
          <ServiceAccountEmail email={email} />
        </Stack>
      )}
      <Stack spacing={1}>
        <Typography variant="body2">
          {email ? '2. ' : ''}Paste the link from the form editor&apos;s address bar (it ends with{' '}
          <Box component="code">/edit</Box>):
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            size="small"
            label="Form editor link"
            placeholder="https://docs.google.com/forms/d/…/edit"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            sx={{ flex: 1, minWidth: 0 }}
          />
          <Button
            variant="contained"
            onClick={submit}
            disabled={!url.trim() || connect.isPending}
            sx={{ flexShrink: 0 }}
          >
            {connect.isPending ? 'Connecting…' : 'Connect'}
          </Button>
        </Stack>
      </Stack>
      {connect.isError && <Alert severity="error">{apiErrorMessage(connect.error)}</Alert>}
    </Stack>
  )
}

function formatTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleTimeString() : 'never'
}

function ConnectedForm({ form, email }: { form: GoogleFormSource; email: string | null }) {
  const sync = useSyncGoogleForm()
  const disconnect = useDisconnectGoogleForm()
  const busy = sync.isPending || disconnect.isPending

  const fields = [
    ['nick', form.mapping.player_id],
    ['prompt', form.mapping.prompt_text],
    ['email', form.mapping.email],
  ].filter(([, title]) => title)

  return (
    <Stack spacing={2.5}>
      <Stack spacing={0.5}>
        <Link href={form.edit_url} target="_blank" rel="noreferrer" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
          {form.title}
        </Link>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Reading {fields.map(([field, title]) => `${field} ← “${title}”`).join(' · ')}
        </Typography>
      </Stack>

      <Stack direction="row" sx={{ gap: 4, flexWrap: 'wrap' }}>
        <Figure label="Imported" value={form.imported_count} />
        <Figure label="Skipped" value={form.skipped_count} />
        <Figure label="Last sync" value={formatTime(form.last_synced_at)} />
      </Stack>

      {form.skipped_count > 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Skipped responses are missing a nick or have a prompt shorter than 3 characters.
        </Typography>
      )}
      {form.last_error && <Alert severity="error">{form.last_error}</Alert>}
      {sync.isSuccess && (
        <Alert severity="success">
          {sync.data.imported === 0 ? 'No new responses.' : `Imported ${sync.data.imported} new prompt(s).`}
        </Alert>
      )}
      {sync.isError && <Alert severity="error">{apiErrorMessage(sync.error)}</Alert>}
      {disconnect.isError && <Alert severity="error">{apiErrorMessage(disconnect.error)}</Alert>}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button variant="contained" disabled={busy} onClick={() => sync.mutate(undefined)}>
          {sync.isPending ? 'Syncing…' : 'Sync now'}
        </Button>
        <Button variant="outlined" color="error" disabled={busy} onClick={() => disconnect.mutate(undefined)}>
          Disconnect
        </Button>
      </Stack>

      {email && (
        <Typography variant="body2" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
          Shared with <Box component="code">{email}</Box>. Removing it from the form&apos;s collaborators
          stops the import.
        </Typography>
      )}
    </Stack>
  )
}

export function GoogleFormSourcePanel() {
  const { data: status, isLoading, isError, error } = useGoogleFormStatus()

  let slug = 'Not connected'
  let body
  if (isLoading) {
    slug = '…'
    body = <Typography sx={{ color: 'text.secondary' }}>Checking the form connection…</Typography>
  } else if (isError || !status) {
    slug = 'Unavailable'
    body = <Alert severity="error">{apiErrorMessage(error)}</Alert>
  } else if (!status.credentials_configured) {
    slug = 'Setup needed'
    body = (
      <Alert severity="warning">
        {status.credentials_error} See <Box component="code">{SETUP_DOC}</Box>.
      </Alert>
    )
  } else if (status.form) {
    slug = `Connected · every ${status.poll_interval_seconds}s`
    body = <ConnectedForm form={status.form} email={status.service_account_email} />
  } else {
    body = <ConnectForm email={status.service_account_email} />
  }

  return (
    <Panel title="Player entry form" slug={slug}>
      {body}
    </Panel>
  )
}
