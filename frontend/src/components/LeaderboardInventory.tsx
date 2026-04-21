import { Card, CardContent, Divider, List, ListItem, Stack, Typography } from '@mui/material'

import type { LeaderboardEntry } from '../types'

interface Props {
  entries: LeaderboardEntry[]
}

export function LeaderboardInventory({ entries }: Props) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Leaderboard & Inventory
        </Typography>
        <List>
          {entries.map((entry) => (
            <Stack key={entry.playerId}>
              <ListItem alignItems="flex-start">
                <Stack spacing={1}>
                  <Typography variant="body2">{`${entry.playerId} • Win Rate: ${entry.winRate}%`}</Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap>
                    {entry.items.map((item) => (
                      <Typography variant="caption" key={item}>
                        {item}
                      </Typography>
                    ))}
                  </Stack>
                </Stack>
              </ListItem>
              <Divider />
            </Stack>
          ))}
        </List>
      </CardContent>
    </Card>
  )
}
