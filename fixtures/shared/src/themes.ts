// The themes every fixture renders. Fixtures may hold hex values: they are test data, not the engine.

export const lightTheme = {
  palette: {
    background: '#ffffff',
    surface: '#f4f1ee',
    text: '#1f1a17',
    muted: '#6b625c',
    primary: '#8a4b2a',
    onPrimary: '#ffffff',
    border: '#d8cfc8',
    accent: '#b3261e',
  },
  space: [0, 4, 8, 16, 24, 32],
  radii: [0, 4, 8],
  fontSizes: [12, 14, 16, 20, 28],
  breakpoints: ['600px'],
}

export const darkTheme = {
  ...lightTheme,
  palette: {
    background: '#101114',
    surface: '#1b1d22',
    text: '#f2eeea',
    muted: '#a39a93',
    primary: '#e0a07a',
    onPrimary: '#1a0f08',
    border: '#3a3d45',
    accent: '#ff8a80',
  },
}

/** The theme of the nested section: it changes the surface and the primary colour only. */
export const brandTheme = {
  palette: { surface: '#fff4d6', primary: '#2a6f8a' },
}

/** Where the choice of scheme is stored. */
export const STORAGE_KEY = 'umber-fixture-scheme'

/** The shape of the themes of the fixtures. */
export type AppTheme = typeof lightTheme
