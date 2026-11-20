import { Box, Button, Stack, Typography } from '@mui/material'

import { Figure } from '../Figure'
import { Panel } from '../Panel'
import { Monogram } from './AgentSeats'
import { TONE_COLOR, describeCall, formatSeconds } from '../../liveGame'
import { pluralize } from '../../plural'
import { summarizeDiary, type DiaryEntry } from '../../replay'
import type { SessionBid } from '../../types'

interface Props {
  name: string
  entries: DiaryEntry[]
  selectedLot: number
  onWatch: (lotNumber: number) => void
}

function CallChip({ call }: { call: SessionBid }) {
  const summary = describeCall(call)
  const label =
    call.outcome === 'pass' ? 'pass' : call.outcome === 'no_answer' || (call.bid === null && !call.won) ? '–' : String(call.bid)
  const filled = summary.tone === 'won'
  return (
    <Box
      component="li"
      title={`Round ${call.round}: ${summary.text}${summary.tag ? `, ${summary.tag.toLowerCase()}` : ''}`}
      sx={{
        typography: 'caption',
        fontWeight: 500,
        px: 0.75,
        borderRadius: 1,
        border: 1,
        borderColor: summary.tone === 'lead' || filled ? 'primary.main' : summary.tone === 'rejected' ? 'error.main' : 'divider',
        bgcolor: filled ? 'primary.main' : 'transparent',
        color: filled ? 'primary.contrastText' : TONE_COLOR[summary.tone],
        textDecoration: summary.tone === 'rejected' ? 'line-through' : 'none',
        lineHeight: 1.6,
      }}
    >
      {label}
    </Box>
  )
}

function resultText(entry: DiaryEntry): { text: string; color: string } {
  switch (entry.result) {
    case 'bought':
      return { text: `Bought for ${entry.lot.price}`, color: 'primary.main' }
    case 'outbid':
      return {
        text: entry.lot.status === 'sold' ? `Lost to ${entry.lot.sold_to_name} at ${entry.lot.price}` : `Top bid ${entry.topBid}, unsold`,
        color: 'text.primary',
      }
    case 'in_play':
      return { text: 'On the block', color: 'secondary.main' }
    default:
      return { text: 'Stayed out', color: 'text.secondary' }
  }
}

function DiaryRow({ entry, selected, onWatch }: { entry: DiaryEntry; selected: boolean; onWatch: () => void }) {
  const { lot, calls } = entry
  const result = resultText(entry)
  const lastReason = [...calls].reverse().find((c) => c.reason)?.reason ?? null

  return (
    <Box
      component="li"
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 0 },
        bgcolor: selected ? 'action.hover' : 'transparent',
      }}
    >
      <Box component="details">
        <Box
          component="summary"
          sx={{
            listStyle: 'none',
            '&::-webkit-details-marker': { display: 'none' },
            cursor: 'pointer',
            display: 'grid',
            gridTemplateColumns: { xs: '28px 1fr', md: '28px minmax(150px, 1.1fr) minmax(0, 1.4fr) minmax(130px, auto)' },
            columnGap: 2,
            rowGap: 0.75,
            alignItems: 'center',
            px: { xs: 2, sm: 2.5 },
            py: 1.5,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <Typography variant="caption" data-figure sx={{ color: 'text.secondary' }}>
            {lot.number}
          </Typography>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: lot.required ? 'text.primary' : 'text.secondary' }}>
              {lot.item}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Quality {lot.quality}, {lot.required ? 'required' : 'not required'}
            </Typography>
          </Box>
          <Stack
            component="ol"
            direction="row"
            aria-label="Calls by round"
            sx={{ listStyle: 'none', m: 0, p: 0, gap: 0.5, flexWrap: 'wrap', gridColumn: { xs: '2', md: 'auto' } }}
          >
            {calls.length > 0 ? (
              calls.map((call) => <CallChip key={call.round} call={call} />)
            ) : (
              <Typography component="li" variant="caption" sx={{ color: 'text.disabled' }}>
                No calls
              </Typography>
            )}
          </Stack>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, color: result.color, textAlign: { md: 'right' }, gridColumn: { xs: '2', md: 'auto' } }}
          >
            {result.text}
          </Typography>
          {lastReason && (
            <Typography
              variant="body2"
              sx={{
                gridColumn: { xs: '2', md: '2 / -1' },
                fontStyle: 'italic',
                color: 'text.secondary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {lastReason}
            </Typography>
          )}
        </Box>

        <Stack spacing={1} sx={{ px: { xs: 2, sm: 2.5 }, pb: 2, pl: { xs: 2, sm: 'calc(28px + 36px)' } }}>
          {calls.map((call) => {
            const summary = describeCall(call)
            return (
              <Box
                key={call.round}
                sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '72px 170px 1fr auto' }, columnGap: 2, alignItems: 'baseline' }}
              >
                <Typography variant="caption" data-figure sx={{ color: 'text.secondary' }}>
                  Round {call.round}
                </Typography>
                <Typography variant="body2" sx={{ color: TONE_COLOR[summary.tone], fontWeight: 600 }}>
                  {summary.text}
                  {summary.tag && (
                    <Box component="span" sx={{ typography: 'caption', fontWeight: 400, ml: 1 }}>
                      {summary.tag}
                    </Box>
                  )}
                </Typography>
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                  {call.reason ?? ''}
                </Typography>
                <Typography variant="caption" data-figure sx={{ color: 'text.disabled' }}>
                  {formatSeconds(call.response_ms)}
                </Typography>
              </Box>
            )
          })}
          <Box>
            <Button size="small" variant="outlined" onClick={onWatch}>
              Watch lot {lot.number}
            </Button>
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}

/** Everything one agent said during the session, lot by lot. */
export function AgentDiary({ name, entries, selectedLot, onWatch }: Props) {
  const summary = summarizeDiary(entries)
  return (
    <Panel title={`${name}, lot by lot`} slug={pluralize(entries.length, 'lot')} flush>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', gap: { xs: 2.5, sm: 4 }, flexWrap: 'wrap', px: { xs: 2, sm: 2.5 }, py: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Monogram name={name} active={summary.bought > 0} />
        <Figure label="Bought" value={summary.bought} emphasis={summary.bought > 0} />
        <Figure label="Spent" value={summary.spent} suffix="pts" />
        <Figure label="Valid bids" value={summary.valid} />
        <Figure label="Passes" value={summary.passes} />
        <Figure label="Rejected" value={summary.rejected} />
        <Figure label="No answer" value={summary.silent} />
        {summary.avgSeconds !== null && <Figure label="Avg answer" value={summary.avgSeconds.toFixed(1)} suffix="s" />}
      </Stack>
      {entries.length === 0 ? (
        <Typography sx={{ color: 'text.secondary', p: 2.5 }}>No lots have closed yet.</Typography>
      ) : (
        <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {entries.map((entry) => (
            <DiaryRow
              key={entry.lot.number}
              entry={entry}
              selected={entry.lot.number === selectedLot}
              onWatch={() => onWatch(entry.lot.number)}
            />
          ))}
        </Box>
      )}
    </Panel>
  )
}
