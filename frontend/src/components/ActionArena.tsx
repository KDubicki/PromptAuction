import { Card, CardContent, Chip, List, ListItem, ListItemText, Stack, Typography } from '@mui/material'

interface Props {
  currentItem: string
  liveBids: Array<{ player: string; bid: number }>
}

export function ActionArena({ currentItem, liveBids }: Props) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Action Arena</Typography>
          <Chip color="secondary" label={`Current Item: ${currentItem}`} />
          <Typography variant="subtitle2">Live LLM Bid Feed</Typography>
          <List dense>
            {liveBids.map((entry) => (
              <ListItem key={`${entry.player}-${entry.bid}`}>
                <ListItemText primary={`${entry.player} bids ${entry.bid} credits`} />
              </ListItem>
            ))}
          </List>
        </Stack>
      </CardContent>
    </Card>
  )
}
