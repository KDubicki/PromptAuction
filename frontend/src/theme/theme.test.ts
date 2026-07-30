import { describe, expect, it } from 'vitest'

import { buildTheme } from './index'
import { palette } from './tokens'

describe('buildTheme', () => {
  it('builds the dark console palette', () => {
    const theme = buildTheme('dark')
    expect(theme.palette.mode).toBe('dark')
    expect(theme.palette.background.default).toBe(palette.dark.vault)
    expect(theme.palette.background.paper).toBe(palette.dark.rostrum)
    expect(theme.palette.primary.main).toBe(palette.dark.brass)
    expect(theme.palette.secondary.main).toBe(palette.dark.signal)
  })

  it('builds the light console palette', () => {
    const theme = buildTheme('light')
    expect(theme.palette.mode).toBe('light')
    expect(theme.palette.background.default).toBe(palette.light.vault)
    expect(theme.palette.primary.main).toBe(palette.light.brass)
  })

  it('sets the display face on headings and the mono face on the utility register', () => {
    const theme = buildTheme('dark')
    expect(theme.typography.h1.fontFamily).toContain('Archivo')
    expect(theme.typography.body1.fontFamily).toContain('IBM Plex Sans')
    expect(theme.typography.overline.fontFamily).toContain('IBM Plex Mono')
    expect(theme.typography.caption.fontFamily).toContain('IBM Plex Mono')
  })

  it('keeps button labels in sentence case', () => {
    expect(buildTheme('dark').typography.button.textTransform).toBe('none')
  })
})
