import { BreakpointQuery } from '../../helpers-client'
import { helperTheme, ThemeProvider } from '../../helpers-style'
import { ServerFrame } from '../../parts'

// A theme with hidden helpers on its breakpoints under server providers (#81): the outer one has a partial
// theme, so the first provider of the request sends the base theme with it; the inner one is given the whole
// theme. The client component below calls `theme.breakpoints.up('md')`, a helper that does not cross: it
// is the one of the base theme of the client build, whose sizes are the same.
export default function CspServerHelpersPage() {
  return (
    <ServerFrame testId="page-csp-server-helpers" title="Helpers">
      <ThemeProvider theme={{ palette: { surface: '#e9efe3' } }}>
        <ThemeProvider theme={helperTheme}>
          <BreakpointQuery />
        </ThemeProvider>
      </ThemeProvider>
    </ServerFrame>
  )
}
