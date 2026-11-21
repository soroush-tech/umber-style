// What the client components of the routes under /s import: the cookie, and the themes of their own
// providers. Fixtures may hold hex values: they are test data.

/** The cookie that the root layout of /s reads, and the switch writes. */
export const ROOT_COOKIE = 'umber-fixture-root'

export type RootScheme = 'light' | 'dark'

export const accentTheme = { palette: { surface: '#e6f4ea', primary: '#0b7a4b' } }
export const clientTheme = { palette: { surface: '#e0f7fa' } }
