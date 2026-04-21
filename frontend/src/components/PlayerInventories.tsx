import { Card, CardContent, List, ListItem, ListItemText, Typography } from '@mui/material'

import type { LeaderboardEntry } from '../types'

interface Props {
  players: LeaderboardEntry[]
}

export function PlayerInventories({ players }: Props) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Player Inventories
        </Typography>
        <List dense>
          {players.map((player) => (
            <ListItem key={player.playerId}>
              <ListItemText primary={player.playerId} secondary={player.items.join(', ')} />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  )
}
