import { Callout, Card, Muted, Page } from '@umber-fixtures/shared/components'
import { Global, ThemeProvider } from '@umber-fixtures/shared/style'
import { cookies } from 'next/headers'
import { Suspense } from 'react'
import {
  accentTheme,
  brandDark,
  brandLight,
  lateTheme,
  readRootScheme,
  ROOT_COOKIE,
  rootDark,
  rootLight,
} from '../../../scheme-themes'
import { ClientProvided, ClientThemeProbe, PortalProbe } from '../../client'
import { Beat, brandGlobal, Late, WhenProbe } from '../../parts'
import { ThemeProbe } from '../../theme-probe'

// A nested provider and what reads its theme: its theme and scheme follow the cookie of the root.
export default async function BrandPage() {
  const scheme = readRootScheme((await cookies()).get(ROOT_COOKIE)?.value)
  return (
    <Page data-testid="page-s-brand">
      <ThemeProvider theme={scheme === 'dark' ? brandDark : brandLight} colorScheme={scheme}>
        <Card data-testid="s-brand-card">
          <WhenProbe data-testid="s-when">When</WhenProbe>
          <ThemeProbe testId="s-server-theme" />
          <ClientThemeProbe testId="s-client-theme" />
          <Global styles={brandGlobal} />
          <Muted data-testid="s-global-target">Outlined by a global rule</Muted>
          <Beat data-testid="s-beat" />
          <Callout data-testid="s-callout">Accent</Callout>
          <PortalProbe />
          <ClientProvided>
            <Card data-testid="s-client-card">Client provider</Card>
          </ClientProvided>
          <Suspense fallback={<Muted data-testid="s-slow-fallback">Loading</Muted>}>
            <Late ms={400}>
              <Card data-testid="s-slow-in-brand">Late in the brand theme</Card>
            </Late>
          </Suspense>
        </Card>
        <ThemeProvider theme={(outer) => ({ palette: { text: outer.palette.surface } })}>
          <Card data-testid="s-function-card">Function theme</Card>
        </ThemeProvider>
      </ThemeProvider>
      <ThemeProvider theme={accentTheme}>
        <Card data-testid="s-sibling-card">Sibling</Card>
      </ThemeProvider>
      <ThemeProvider theme={scheme === 'dark' ? rootDark : rootLight}>
        <Card data-testid="s-equal-card">Equal to the root</Card>
      </ThemeProvider>
      <ThemeProvider theme={{}}>
        <Card data-testid="s-empty-card">Empty</Card>
      </ThemeProvider>
      <Suspense fallback={<Muted data-testid="s-late-fallback">Loading</Muted>}>
        <Late ms={400}>
          <ThemeProvider theme={lateTheme}>
            <Card data-testid="s-late-card">A provider that arrives late</Card>
          </ThemeProvider>
        </Late>
      </Suspense>
    </Page>
  )
}
