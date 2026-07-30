import { createTheme, type Theme } from '@mui/material/styles'

import { fonts, line, palette, radius, text, type ColorMode } from './tokens'

export { fonts, palette, radius, type ColorMode } from './tokens'

/**
 * Builds the console theme for a colour mode.
 *
 * Type carries the personality: Archivo for display, IBM Plex Sans for prose,
 * IBM Plex Mono for every figure. Figures are tabular so bid columns align
 * down the page.
 */
export function buildTheme(mode: ColorMode): Theme {
  const c = palette[mode]
  const t = text[mode]
  const divider = line[mode]
  const isDark = mode === 'dark'

  return createTheme({
    palette: {
      mode,
      primary: { main: c.brass, contrastText: isDark ? '#12202F' : '#FFFFFF' },
      secondary: { main: c.signal },
      error: { main: c.reject },
      success: { main: c.brass },
      info: { main: c.signal },
      background: { default: c.vault, paper: c.rostrum },
      text: { primary: t.primary, secondary: t.secondary, disabled: t.disabled },
      divider,
    },

    shape: { borderRadius: radius.md },

    typography: {
      fontFamily: fonts.body,
      h1: { fontFamily: fonts.display, fontWeight: 700, fontSize: '3rem', letterSpacing: '-0.02em', lineHeight: 1.05 },
      h2: { fontFamily: fonts.display, fontWeight: 700, fontSize: '2.25rem', letterSpacing: '-0.02em', lineHeight: 1.1 },
      h3: { fontFamily: fonts.display, fontWeight: 700, fontSize: '1.75rem', letterSpacing: '-0.015em', lineHeight: 1.15 },
      h4: { fontFamily: fonts.display, fontWeight: 600, fontSize: '1.375rem', letterSpacing: '-0.01em' },
      h5: { fontFamily: fonts.display, fontWeight: 600, fontSize: '1.125rem', letterSpacing: '-0.01em' },
      h6: { fontFamily: fonts.display, fontWeight: 600, fontSize: '1rem', letterSpacing: '-0.005em' },
      body1: { fontSize: '1rem', lineHeight: 1.6 },
      body2: { fontSize: '0.875rem', lineHeight: 1.55 },
      button: { fontWeight: 600, textTransform: 'none', letterSpacing: 0 },
      // The utility register: panel slugs, column heads, status labels.
      overline: {
        fontFamily: fonts.data,
        fontSize: '0.6875rem',
        fontWeight: 500,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        lineHeight: 1.4,
      },
      caption: { fontFamily: fonts.data, fontSize: '0.75rem', letterSpacing: '0.01em' },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': { colorScheme: mode },
          body: { WebkitFontSmoothing: 'antialiased', backgroundColor: c.vault },
          // Figures line up in columns wherever mono is used.
          'code, kbd, samp, pre': { fontFamily: fonts.data },
          '*:focus-visible': { outline: `2px solid ${c.signal}`, outlineOffset: 2 },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              animationDuration: '0.01ms !important',
              animationIterationCount: '1 !important',
              transitionDuration: '0.01ms !important',
            },
          },
        },
      },

      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: { borderColor: divider },
        },
      },

      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${divider}`,
            borderRadius: radius.lg,
            backgroundColor: c.rostrum,
          },
        },
      },

      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: radius.sm, minHeight: 40, paddingInline: 16 },
          sizeSmall: { minHeight: 34 },
          // Touch targets stay comfortable on phones.
          sizeLarge: { minHeight: 48 },
        },
      },

      MuiIconButton: {
        styleOverrides: { root: { borderRadius: radius.sm } },
      },

      MuiChip: {
        styleOverrides: {
          root: { fontFamily: fonts.data, fontSize: '0.75rem', borderRadius: radius.sm, fontWeight: 500 },
          label: { paddingInline: 8 },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          root: { borderBottomColor: divider },
          head: {
            fontFamily: fonts.data,
            fontSize: '0.6875rem',
            fontWeight: 500,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: t.secondary,
            whiteSpace: 'nowrap',
          },
        },
      },

      MuiTableRow: {
        styleOverrides: {
          root: { '&:last-child td': { borderBottom: 0 } },
        },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: radius.sm },
          notchedOutline: { borderColor: divider },
        },
      },

      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: radius.md, border: `1px solid ${divider}` },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: { fontFamily: fonts.body, fontSize: '0.75rem' },
        },
      },

      MuiDrawer: {
        styleOverrides: {
          paper: { backgroundColor: isDark ? c.vault : c.rostrum, borderColor: divider },
        },
      },

      MuiLink: {
        defaultProps: { underline: 'hover' },
        styleOverrides: { root: { color: c.signal } },
      },
    },
  })
}
