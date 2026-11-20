import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

import { initials } from '../../replay'
import type { Lot } from '../../types'

interface Props {
  lots: Lot[]
  selected: number
  /** The lot on the block right now, if the auction is still going. */
  liveNumber: number | null
  /** Lots bought by the agent being followed are marked. */
  followedRef: string | null
  onSelect: (lotNumber: number) => void
  onLive?: () => void
}

function tileLabel(lot: Lot, live: boolean): string {
  const head = `Lot ${lot.number}, ${lot.item}, quality ${lot.quality}${lot.required ? ', required' : ''}`
  if (live) return `${head}, on the block now`
  if (lot.status === 'sold') return `${head}, sold to ${lot.sold_to_name} for ${lot.price}`
  if (lot.status === 'unsold') return `${head}, unsold`
  return `${head}, upcoming`
}

/**
 * The whole session at a glance: one tile per lot, filled to the price it went
 * for. Picking a tile replays that lot.
 */
export function LotStrip({ lots, selected, liveNumber, followedRef, onSelect, onLive }: Props) {
  const selectedRef = useRef<HTMLButtonElement | null>(null)
  const maxPrice = Math.max(1, ...lots.map((l) => l.price ?? 0))
  const reachable = (lot: Lot) => lot.status !== 'pending' || lot.number === liveNumber
  const lastReachable = lots.filter(reachable).at(-1)?.number ?? 1

  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [selected])

  const step = (delta: number) => {
    const next = Math.min(lastReachable, Math.max(1, selected + delta))
    if (next !== selected) onSelect(next)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      step(1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      step(-1)
    }
  }

  const viewingPast = liveNumber !== null && selected !== liveNumber

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6" component="h2">
          Lots
        </Typography>
        <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
          {viewingPast && onLive && (
            <Button size="small" variant="contained" color="secondary" onClick={onLive}>
              Back to live
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            aria-label="Previous lot"
            onClick={() => step(-1)}
            disabled={selected <= 1}
            sx={{ minWidth: 40, px: 1 }}
          >
            <ChevronLeftIcon fontSize="small" />
          </Button>
          <Button
            size="small"
            variant="outlined"
            aria-label="Next lot"
            onClick={() => step(1)}
            disabled={selected >= lastReachable}
            sx={{ minWidth: 40, px: 1 }}
          >
            <ChevronRightIcon fontSize="small" />
          </Button>
        </Stack>
      </Stack>

      <Box
        role="toolbar"
        aria-label="Lots of this session"
        onKeyDown={onKeyDown}
        sx={{ display: 'flex', gap: '6px', overflowX: 'auto', pb: 1, scrollbarWidth: 'thin' }}
      >
        {lots.map((lot) => {
          const live = lot.number === liveNumber
          const isSelected = lot.number === selected
          const fill = lot.status === 'sold' ? Math.max(8, ((lot.price ?? 0) / maxPrice) * 100) : 0
          const followedBuy = followedRef !== null && lot.sold_to === followedRef
          return (
            <Box
              key={lot.number}
              component="button"
              type="button"
              ref={isSelected ? selectedRef : undefined}
              aria-label={tileLabel(lot, live)}
              aria-pressed={isSelected}
              disabled={!reachable(lot)}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onSelect(lot.number)}
              sx={{
                flex: '0 0 auto',
                width: 56,
                height: 92,
                p: 0,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                font: 'inherit',
                color: 'text.primary',
                bgcolor: 'background.paper',
                borderRadius: 2,
                border: isSelected ? 2 : 1,
                borderStyle: lot.status === 'unsold' ? 'dashed' : 'solid',
                borderColor: isSelected ? 'text.primary' : live ? 'secondary.main' : 'divider',
                overflow: 'hidden',
                opacity: lot.required || lot.status === 'pending' ? 1 : 0.62,
                transition: 'transform 150ms ease, border-color 150ms ease',
                '&:hover:not(:disabled)': { transform: 'translateY(-2px)' },
                '&:disabled': { cursor: 'default', opacity: 0.4 },
              }}
            >
              <Box
                aria-hidden
                sx={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: `${fill}%`,
                  bgcolor: 'primary.main',
                  opacity: isSelected ? 0.5 : 0.3,
                  transition: 'height 500ms ease',
                }}
              />
              <Typography
                variant="caption"
                data-figure
                sx={{ position: 'relative', pt: 0.75, color: live ? 'secondary.main' : 'text.secondary', fontWeight: live ? 600 : 400 }}
              >
                {lot.number}
              </Typography>
              <Box sx={{ position: 'relative', pb: 0.75, display: 'grid', gap: 0.25, justifyItems: 'center' }}>
                {lot.status === 'sold' ? (
                  <>
                    <Typography variant="caption" data-figure sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                      {lot.price}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.625rem',
                        lineHeight: 1.2,
                        px: 0.5,
                        borderRadius: 0.5,
                        color: followedBuy ? 'secondary.contrastText' : 'text.secondary',
                        bgcolor: followedBuy ? 'secondary.main' : 'transparent',
                      }}
                    >
                      {initials(lot.sold_to_name ?? '')}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="caption" sx={{ fontSize: '0.625rem', color: live ? 'secondary.main' : 'text.disabled' }}>
                    {live ? 'Live' : lot.status === 'unsold' ? 'Unsold' : '·'}
                  </Typography>
                )}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Stack>
  )
}
