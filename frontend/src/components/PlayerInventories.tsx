import { Chip, Stack, Typography } from '@mui/material'

import { Panel } from './Panel'
import type { LeaderboardEntry } from '../types'

interface Props {
  players: LeaderboardEntry[]
}

export function PlayerInventories({ players }: Props) {
  const lotsWon = players.reduce((total, player) => total + player.items.length, 0)

  return (
    <Panel title="Inventories" slug={`${lotsWon} lots held`} flush>
      {players.length === 0 ? (
        <Typography sx={{ color: 'text.secondary', p: 2.5 }}>Nothing has been won yet.</Typography>
      ) : (
        <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {players.map((player, index) => (
            <Stack
              key={player.playerId}
              component="li"
              spacing={1}
              sx={{
                px: { xs: 2, sm: 2.5 },
                py: 1.75,
                borderBottom: index < players.length - 1 ? 1 : 0,
                borderColor: 'divider',
              }}
            >
              <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                {player.playerId}
              </Typography>
              {player.items.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                  Holding nothing
                </Typography>
              ) : (
                <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
                  {player.items.map((item) => (
                    <Chip key={item} size="small" variant="outlined" label={item} />
                  ))}
                </Stack>
              )}
            </Stack>
          ))}
        </Stack>
      )}
    </Panel>
  )
}
