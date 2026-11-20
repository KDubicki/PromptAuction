import { Card, Stack, Typography } from '@mui/material'

import { Figure } from '../Figure'
import type { GameSession } from '../../types'

function names(list: string[]): string {
  return list.length <= 1 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

/** The hammer has fallen on the last lot: the winner takes the stage. */
export function WinnerStage({ session }: { session: GameSession }) {
  const winners = session.standings.filter((s) => s.rank === 1)
  const top = winners[0]
  const sold = session.lots.filter((lot) => lot.status === 'sold').length

  return (
    <Card component="section" aria-labelledby="winner" sx={{ borderColor: 'primary.main' }}>
      <Stack spacing={{ xs: 3, sm: 4 }} sx={{ px: { xs: 2, sm: 4 }, py: { xs: 3, sm: 5 } }}>
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
          }}
        >
          {top ? `${names(winners.map((w) => w.name))} ${winners.length > 1 ? 'share the win' : 'wins'}` : 'No winner'}
        </Typography>
        {top && (
          <Stack direction="row" sx={{ gap: { xs: 3, sm: 6 }, flexWrap: 'wrap' }}>
            <Figure label="Required items" value={top.unique_required} suffix={`of ${session.required_items.length}`} emphasis />
            <Figure label="Quality" value={top.quality} />
            <Figure label="Budget left" value={top.budget} suffix="pts" />
          </Stack>
        )}
      </Stack>
    </Card>
  )
}
