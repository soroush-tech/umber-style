import { darkTheme, lightTheme } from '@umber-fixtures/shared/themes'
import type { RootScheme } from './client-themes'

// The themes of the routes under /s and /bare: a root theme that the server chooses from a cookie, and
// the partial themes of the providers below it. Fixtures may hold hex values: they are test data. Only
// server files import this module, so that an edit of a theme here reaches the page as a refresh of
// server components; what client files need is in client-themes.ts.

export * from './client-themes'

/** The scheme that the cookie holds: dark only when it says so. */
export const readRootScheme = (value: string | undefined): RootScheme =>
  value === 'dark' ? 'dark' : 'light'

/** The root theme of /s in light: the shared light theme, as an object of its own. */
export const rootLight = { ...lightTheme, palette: { ...lightTheme.palette, surface: '#f4f1ee' } }
export const rootDark = darkTheme

/** The nested theme of the brand page, one for each root scheme. */
export const brandLight = { palette: { surface: '#fff4d6', primary: '#2a6f8a' } }
export const brandDark = { palette: { surface: '#2a2410', primary: '#7ab8d0' } }

export const deepTheme = { palette: { surface: '#f3e8fd' } }
export const oneTheme = { palette: { primary: '#6a1b9a' } }
export const twoTheme = { palette: { primary: '#ad1457' } }
export const otherTheme = { palette: { surface: '#e3f2fd' } }
export const panelTheme = { palette: { surface: '#fbe9e7' } }
export const lateTheme = { palette: { surface: '#fffde7' } }
