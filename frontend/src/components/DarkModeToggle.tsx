import LightModeIcon from '@mui/icons-material/LightMode'
import NightlightIcon from '@mui/icons-material/Nightlight'
import { IconButton, Tooltip } from '@mui/material'

interface Props {
  darkMode: boolean
  onToggle: () => void
}

export function DarkModeToggle({ darkMode, onToggle }: Props) {
  return (
    <Tooltip title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton onClick={onToggle} color="inherit">
        {darkMode ? <LightModeIcon /> : <NightlightIcon />}
      </IconButton>
    </Tooltip>
  )
}
