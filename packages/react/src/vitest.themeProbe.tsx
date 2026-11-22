// One source for a component that reads the theme, which the tests of both builds render: as a server
// component (the server build) and as a client component (the client build). It calls `useTheme()` of
// the style it is given, and nothing else, as a component written once for both would.

export const probeTheme = {
  palette: { primary: '#0000ff', surface: '#ffffff' },
  breakpoints: ['600px'],
}

export const nestedTheme = { palette: { surface: '#fff4d6' } }

/** The component, over `style`: it prints the surface and the first breakpoint of the theme it reads. */
export function createThemeProbe(style: { useTheme(): typeof probeTheme }) {
  return function ThemeProbe({ id }: { id: string }) {
    const theme = style.useTheme()
    return <code data-id={id}>{`${theme.palette.surface} ${theme.breakpoints[0]}`}</code>
  }
}
