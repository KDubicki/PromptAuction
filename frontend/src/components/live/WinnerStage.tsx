import { Box, Card, Stack, Typography } from '@mui/material'

import { Figure } from '../Figure'
import { fadeUp, useCountUp } from '../../motion'
import type { GameSession } from '../../types'

function names(list: string[]): string {
  return list.length <= 1 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

/** The hammer has fallen on the last lot: the winner takes the stage. */
export function WinnerStage({ session }: { session: GameSession }) {
  const winners = session.standings.filter((s) => s.rank === 1)
  const top = winners[0]
  const sold = session.lots.filter((lot) => lot.status === 'sold').length
  const runnersUp = session.standings.filter((s) => s.rank !== 1).slice(0, 4)
  const items = useCountUp(top?.unique_required ?? 0, { from: 0, durationMs: 900 })
  const quality = useCountUp(top?.quality ?? 0, { from: 0, durationMs: 900 })
  const budget = useCountUp(top?.budget ?? 0, { from: 0, durationMs: 1100 })

  return (
    <Card component="section" aria-labelledby="winner" sx={{ borderColor: 'primary.main' }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        sx={{ px: { xs: 2, sm: 4 }, py: { xs: 3, sm: 5 }, gap: { xs: 4, md: 6 }, justifyContent: 'space-between' }}
      >
      <Stack spacing={{ xs: 3, sm: 4 }} sx={{ minWidth: 0 }}>
        <Typography variant="overline" data-figure sx={{ color: 'text.secondary' }}>
          Auction closed, {sold} of {session.lots.length} lots sold
        </Typography>
        <Typography
          id="winner"
          component="h2"
          sx={{
            fontFamily: (t) => t.typography.h1.fontFamily,
            fontWeight: 800,
            letterSpacing: '-0.035em',
            lineHeight: 0.95,
            fontSize: { xs: '3rem', sm: '4.5rem', md: '6rem' },
            color: 'primary.main',
            overflowWrap: 'anywhere',
            animation: 'curtain 900ms cubic-bezier(0.7, 0, 0.2, 1) both',
            '@keyframes curtain': {
              from: { clipPath: 'inset(0 100% 0 0)', transform: 'translateX(-12px)' },
              to: { clipPath: 'inset(0 0 0 0)', transform: 'none' },
            },
          }}
        >
          {top ? `${names(winners.map((w) => w.name))} ${winners.length > 1 ? 'share the win' : 'wins'}` : 'No winner'}
        </Typography>
        {top && (
          <Stack direction="row" sx={{ gap: { xs: 3, sm: 6 }, flexWrap: 'wrap' }}>
            <Figure label="Required items" value={items} suffix={`of ${session.required_items.length}`} emphasis />
            <Figure label="Quality" value={quality} />
            <Figure label="Budget left" value={budget} suffix="pts" />
          </Stack>
        )}
      </Stack>
      {runnersUp.length > 0 && (
        <Box component="ol" aria-label="Runners-up" sx={{ listStyle: 'none', m: 0, p: 0, alignSelf: { md: 'flex-end' }, minWidth: { md: 260 }, display: 'grid', gap: 1 }}>
          {runnersUp.map((s) => (
            <Box
              component="li"
              key={s.player_ref}
              sx={{ ...fadeUp(700 + s.rank * 120), display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 1.5, alignItems: 'baseline', py: 1, borderBottom: 1, borderColor: 'divider' }}
            >
              <Typography variant="caption" data-figure sx={{ color: 'text.secondary' }}>
                {s.rank}
              </Typography>
              <Typography sx={{ fontWeight: 600 }}>{s.name}</Typography>
              <Typography variant="caption" data-figure sx={{ color: 'text.secondary' }}>
                {s.unique_required} items, q {s.quality}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
      </Stack>
    </Card>
  )
}
