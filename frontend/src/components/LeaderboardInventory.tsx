import { Box, Chip, Stack, Typography } from '@mui/material'

import { Panel } from './Panel'
import type { LeaderboardEntry } from '../types'

interface Props {
  entries: LeaderboardEntry[]
}

export function LeaderboardInventory({ entries }: Props) {
  const ranked = [...entries].sort((a, b) => b.winRate - a.winRate)

  return (
    <Panel title="Leaderboard" slug={`${entries.length} agents`} flush>
      {ranked.length === 0 ? (
        <Typography sx={{ color: 'text.secondary', p: 2.5 }}>No agents ranked yet.</Typography>
      ) : (
        <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {ranked.map((entry, index) => (
            <Stack
              key={entry.playerId}
              component="li"
              direction="row"
              spacing={2}
              sx={{
                alignItems: 'flex-start',
                px: { xs: 2, sm: 2.5 },
                py: 1.75,
                borderBottom: index < ranked.length - 1 ? 1 : 0,
                borderColor: 'divider',
              }}
            >
              {/* Brass marks the leader and nothing else. */}
              <Typography
                variant="caption"
                data-figure
                sx={{
                  color: index === 0 ? 'primary.main' : 'text.disabled',
                  fontWeight: 500,
                  pt: 0.25,
                  minWidth: 24,
                }}
              >
                {String(index + 1).padStart(2, '0')}
              </Typography>

              <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                <Stack
                  direction="row"
                  sx={{ gap: 1.5, alignItems: 'baseline', justifyContent: 'space-between' }}
                >
                  <Typography sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>
                    {entry.playerId}
                  </Typography>
                  <Box
                    data-figure
                    sx={{
                      fontFamily: (t) => t.typography.caption.fontFamily,
                      fontSize: '0.875rem',
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {entry.winRate}% won
                  </Box>
                </Stack>

                {entry.items.length > 0 && (
                  <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
                    {entry.items.map((item) => (
                      <Chip key={item} size="small" variant="outlined" label={item} />
                    ))}
                  </Stack>
                )}
              </Stack>
            </Stack>
          ))}
        </Stack>
      )}
    </Panel>
  )
}
