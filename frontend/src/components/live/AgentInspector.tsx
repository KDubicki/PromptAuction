import { useEffect, useState, type ReactNode } from 'react'
import { Box, Button, Collapse, Drawer, IconButton, Stack, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

import { Monogram } from './AgentSeats'
import { QualityMeter } from './Rostrum'
import { buildAgentView, callsOf, sameCall } from '../../agentView'
import { TONE_COLOR, describeCall, formatSeconds } from '../../liveGame'
import { fadeUp } from '../../motion'
import type { GameSession, SessionBid } from '../../types'

interface Props {
  session: GameSession
  bids: SessionBid[]
  call: SessionBid | null
  onClose: () => void
  onNavigate: (call: SessionBid) => void
}

function Section({ title, delay, children }: { title: string; delay: number; children: ReactNode }) {
  return (
    <Stack component="section" spacing={1.25} sx={fadeUp(delay)}>
      <Typography variant="overline" component="h3" sx={{ color: 'text.secondary' }}>
        {title}
      </Typography>
      {children}
    </Stack>
  )
}

function Reveal({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
      <Button
        fullWidth
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        endIcon={<ExpandMoreIcon sx={{ transition: 'transform 250ms ease', transform: open ? 'rotate(180deg)' : 'none' }} />}
        sx={{ justifyContent: 'space-between', color: 'text.primary', px: 2, borderRadius: 0 }}
      >
        {label}
      </Button>
      <Collapse in={open} unmountOnExit>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
            typography: 'caption',
            fontSize: '0.75rem',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            bgcolor: 'action.hover',
            maxHeight: 420,
            overflow: 'auto',
          }}
        >
          {children}
        </Box>
      </Collapse>
    </Box>
  )
}

/**
 * The agent's side of one call: what it was shown, what it was told, what it
 * said, and why the auction took or ignored it.
 */
export function AgentInspector({ session, bids, call, onClose, onNavigate }: Props) {
  const view = call ? buildAgentView(session, bids, call) : null
  const history = call ? callsOf(bids, call) : []
  const index = call ? history.findIndex((c) => sameCall(c, call)) : -1
  const previous = index > 0 ? history[index - 1] : null
  const next = index >= 0 && index < history.length - 1 ? history[index + 1] : null

  useEffect(() => {
    if (!call) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && previous) onNavigate(previous)
      if (e.key === 'ArrowRight' && next) onNavigate(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [call, previous, next, onNavigate])

  const summary = call ? describeCall(call) : null
  const key = call ? `${call.lot_number}-${call.round}-${call.player_id}` : 'none'

  return (
    <Drawer
      anchor="right"
      open={call !== null}
      onClose={onClose}
      sx={{ zIndex: (t) => t.zIndex.modal }}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 560 }, maxWidth: '100%' }, 'aria-label': 'Agent view' } }}
    >
      {call && view && summary && (
        <Stack sx={{ minHeight: '100%' }}>
          <Stack
            direction="row"
            sx={{
              alignItems: 'center',
              gap: 1.5,
              px: { xs: 2, sm: 3 },
              py: 2,
              borderBottom: 1,
              borderColor: 'divider',
              position: 'sticky',
              top: 0,
              bgcolor: 'background.paper',
              zIndex: 1,
            }}
          >
            <Monogram name={view.entry.name} active={summary.tone === 'won' || summary.tone === 'lead'} />
            <Stack sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" component="h2">
                {view.entry.name}
              </Typography>
              <Typography variant="overline" data-figure sx={{ color: 'text.secondary' }}>
                Lot {call.lot_number}, round {call.round}
                {view.entry.version ? `, prompt v${view.entry.version}` : ''}
              </Typography>
            </Stack>
            <IconButton aria-label="Earlier answer" onClick={() => previous && onNavigate(previous)} disabled={!previous}>
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="caption" data-figure sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
              {index + 1} of {history.length}
            </Typography>
            <IconButton aria-label="Later answer" onClick={() => next && onNavigate(next)} disabled={!next}>
              <ChevronRightIcon />
            </IconButton>
            <IconButton aria-label="Close" onClick={onClose} edge="end">
              <CloseIcon />
            </IconButton>
          </Stack>

          <Stack key={key} spacing={3.5} sx={{ px: { xs: 2, sm: 3 }, py: 3 }}>
            <Stack spacing={1} sx={fadeUp(0)}>
              <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1, color: TONE_COLOR[summary.tone] }}>
                {summary.text}
                {summary.tag && (
                  <Box component="span" sx={{ typography: 'body2', fontWeight: 600, ml: 1.5 }}>
                    {summary.tag}
                  </Box>
                )}
              </Typography>
              <Typography sx={{ color: 'text.secondary' }}>{view.explanation}</Typography>
              {call.reason && (
                <Typography
                  component="blockquote"
                  sx={{ m: 0, mt: 1, pl: 2, borderLeft: 3, borderColor: 'divider', fontStyle: 'italic', fontSize: '1.125rem' }}
                >
                  {call.reason}
                </Typography>
              )}
              {formatSeconds(call.response_ms) && (
                <Typography variant="caption" data-figure sx={{ color: 'text.disabled' }}>
                  Answered in {formatSeconds(call.response_ms)}
                </Typography>
              )}
            </Stack>

            <Section title="What it saw" delay={80}>
              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2, display: 'grid', gap: 1.5 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <Typography sx={{ fontFamily: (t) => t.typography.h1.fontFamily, fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
                    {view.state.lot.item}
                  </Typography>
                  <Typography variant="caption" data-figure sx={{ color: 'text.secondary' }}>
                    Lot {view.state.lot.number} of {view.state.lot.of}, round {view.state.auction.current_round} of{' '}
                    {view.state.auction.max_rounds}
                  </Typography>
                </Stack>
                <QualityMeter quality={view.state.lot.quality} />
                <Typography variant="body2" sx={{ fontWeight: 600, color: view.state.lot.required ? 'text.primary' : 'text.secondary' }}>
                  {view.state.lot.required ? '"required": true' : '"required": false'}
                </Typography>
                <Stack direction="row" sx={{ gap: 3, flexWrap: 'wrap', alignItems: 'baseline', pt: 1, borderTop: 1, borderColor: 'divider' }}>
                  <Box>
                    <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block' }}>
                      Highest bid
                    </Typography>
                    <Typography data-figure sx={{ typography: 'caption', fontSize: '2rem', fontWeight: 500, lineHeight: 1, color: view.state.auction.highest_bid > 0 ? 'primary.main' : 'text.disabled' }}>
                      {view.state.auction.highest_bid}
                    </Typography>
                  </Box>
                  <Typography sx={{ color: 'text.secondary' }}>
                    {view.state.auction.leader
                      ? view.state.auction.leader === view.entry.name
                        ? 'It was leading'
                        : `Held by ${view.state.auction.leader}`
                      : 'Nobody had bid yet'}
                  </Typography>
                </Stack>
              </Box>
            </Section>

            <Section title="Its position" delay={140}>
              <Stack direction="row" sx={{ gap: 3, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <Typography data-figure sx={{ typography: 'caption', fontSize: '1.5rem', fontWeight: 500 }}>
                  {view.me.budget}
                  <Box component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary', ml: 0.75 }}>
                    pts to spend
                  </Box>
                </Typography>
                <Typography variant="body2" sx={{ color: view.ownedCopy ? 'text.primary' : 'text.secondary' }}>
                  {view.ownedCopy
                    ? `Already owned ${view.ownedCopy.item} at quality ${view.ownedCopy.quality}`
                    : `Did not own ${view.state.lot.item} yet`}
                </Typography>
              </Stack>
              <Stack component="ul" direction="row" aria-label="Required items" sx={{ listStyle: 'none', m: 0, p: 0, gap: 0.75, flexWrap: 'wrap' }}>
                {view.state.required_items.map((name) => {
                  const owned = view.me.items.some((it) => it.item === name && it.required)
                  const onBlock = name === view.state.lot.item
                  return (
                    <Box
                      component="li"
                      key={name}
                      title={owned ? `${name}: owned` : `${name}: missing`}
                      sx={{
                        typography: 'caption',
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 1,
                        border: onBlock ? 2 : 1,
                        borderColor: onBlock ? 'primary.main' : 'divider',
                        bgcolor: owned ? 'text.primary' : 'transparent',
                        color: owned ? 'background.paper' : 'text.secondary',
                      }}
                    >
                      {name}
                    </Box>
                  )
                })}
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Filled: required items it owned. Outlined: the item on the block. {view.state.remaining_lots} lots left after this one.
              </Typography>
            </Section>

            <Section title="Rivals" delay={200}>
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.5 }}>
                {view.state.players
                  .filter((p) => p.name !== view.entry.name)
                  .map((p) => {
                    const unique = new Set(p.items.filter((it) => it.required).map((it) => it.item)).size
                    return (
                      <Box
                        component="li"
                        key={p.name}
                        sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 2, alignItems: 'baseline', py: 0.75, borderBottom: 1, borderColor: 'divider' }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {p.name}
                        </Typography>
                        <Typography variant="caption" data-figure sx={{ color: 'text.secondary' }}>
                          {unique} required
                        </Typography>
                        <Typography variant="caption" data-figure sx={{ minWidth: 64, textAlign: 'right' }}>
                          {p.budget} pts
                        </Typography>
                      </Box>
                    )
                  })}
              </Box>
            </Section>

            <Section title="Its instructions" delay={260}>
              <Typography
                sx={{ whiteSpace: 'pre-wrap', fontSize: '0.9375rem', p: 2, borderRadius: 2, bgcolor: 'action.hover', overflowWrap: 'anywhere' }}
              >
                {view.entry.prompt_text || 'No prompt text recorded for this session.'}
              </Typography>
            </Section>

            <Stack spacing={1.25} sx={fadeUp(320)}>
              <Reveal label="Exact message it received">{view.message}</Reveal>
              {call.raw_response ? (
                <Reveal label="Its raw reply">{call.raw_response}</Reveal>
              ) : (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {call.failure
                    ? 'There was no reply text to show.'
                    : 'Raw replies are recorded for rounds played from now on.'}
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                The system prompt with the auction rules is the same for every agent and every round.
              </Typography>
            </Stack>
          </Stack>
        </Stack>
      )}
    </Drawer>
  )
}
