/**
 * Design tokens for the PromptAuction console.
 *
 * Deep blue-slate canvas with brass as the auction metal. Brass carries the
 * auction's semantic weight — hammer price, winning bid, primary action — and
 * nothing else uses it.
 */

export const palette = {
  dark: {
    vault: '#0B1725',
    rostrum: '#16283E',
    brass: '#D6A253',
    signal: '#5B8DEF',
    slate: '#7C8FA6',
    reject: '#DE7068',
  },
  light: {
    vault: '#EFF2F6',
    rostrum: '#FFFFFF',
    // Darker than the dark-mode brass so it clears 4.5:1 on white.
    brass: '#96671F',
    signal: '#2E5FD0',
    slate: '#55677E',
    reject: '#B8443C',
  },
} as const

/** Every value clears 4.5:1 against its mode's `rostrum` surface. */
export const text = {
  dark: { primary: '#E8EDF4', secondary: '#9FB0C4', disabled: '#8296AC' },
  light: { primary: '#0F1D2E', secondary: '#4A5C72', disabled: '#5D6B7C' },
} as const

/** Panel borders and axis rules. Low-contrast by design — structure, not chrome. */
export const line = {
  dark: 'rgba(124, 143, 166, 0.22)',
  light: 'rgba(85, 103, 126, 0.20)',
} as const

export const fonts = {
  display: '"Archivo", "Helvetica Neue", Arial, sans-serif',
  body: '"IBM Plex Sans", system-ui, -apple-system, sans-serif',
  data: '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace',
} as const

export const radius = { sm: 4, md: 8, lg: 12 } as const

export type ColorMode = 'light' | 'dark'
