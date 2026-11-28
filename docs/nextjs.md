# Next.js App Router

After this page you can set up a Next.js App Router app on UmberStyle 0.9.0, file by file: the style module, the root layout with `StyleRegistry`, a server component and a client component, a strict content security policy, and what changes on a static page, under partial prerendering and on the edge runtime. Every file below is copied from the App Router fixture, `fixtures/next-app`, and every claim names the end-to-end scenario or the test that runs it. How the engine does it underneath is in [Server rendering](server-rendering.md) and [The cache and server packages](cache-and-server.md).

The scenarios are named by their letter in the file that holds them: (h) to (x) in `e2e/helpers/cspServer.ts`, (e1) to (e5) in `e2e/helpers/edge.ts`, (p1) to (pc2) in `e2e/helpers/ppr.ts`, and A to N in the shared suite of [Testing](testing.md#the-scenarios). Each runs on the production build and, where [Testing](testing.md#tier-3-in-development) says so, on the development server.

## What works on Next.js

| What                                                                                        | Where it runs                                                                                                                                                 |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server components and client components styled in one page, one class for one style in both | `e2e/tests/next-app.spec.ts`, checks (i) and (iii)                                                                                                            |
| The first HTML styled with JavaScript on and off                                            | Scenario F on every route of the shared app; (s) and (p2) under a policy                                                                                      |
| A page that streams through `Suspense`, the rules of each piece before the piece            | (r), (s2) and (t)                                                                                                                                             |
| A client-side navigation, the page reached styled as when it is loaded directly             | Scenario B; (q), (u) and (s4) under a policy                                                                                                                  |
| A strict nonce policy, with a nonce for each request or one fixed nonce                     | (j) to (x)                                                                                                                                                    |
| Styles made in the browser under that policy: a change of state, a part that mounts later   | (s5) and (s6)                                                                                                                                                 |
| The edge runtime                                                                            | (e1) to (e5)                                                                                                                                                  |
| Partial prerendering, with the parts that do not work                                       | (p1) to (pc2), on `fixtures/next-ppr`; see [Static pages, partial prerendering and the edge runtime](#static-pages-partial-prerendering-and-the-edge-runtime) |

**Versions.** `next` is an optional peer dependency of `@umber-style/react`, `^16.3.0`, read only by the entry `@umber-style/react/next`. CI runs the whole suite of the fixture, production build and development server, on the newest patch of 16.3 and of 16.4 (`NEXT_MINORS` in `.github/workflows/ci.yml`); it passed on 16.3.8 and 16.4.6 ([Testing](testing.md#on-the-nextjs-16-minors)). Below 16.3 the fixture does not build with the repository's TypeScript 7 (what was seen on 16.0.11 is in the Limits of [Server rendering](server-rendering.md#limits)). `react` is `^19.0.0`, but the App Router runs the React that Next.js bundles, not the one the app installs: the React 19.2 or later that a strict nonce policy needs on the server ([Content security policy](server-rendering.md#content-security-policy)) is that of Next.js, and the policy scenarios pass on 16.3 and 16.4.

## Install and the files of a set-up

```sh
pnpm add @umber-style/react
```

Next.js, React and React DOM are the app's own. `StyleRegistry` is in `@umber-style/react/next`; the umbrella has the same entry as `umber-style/react/next`, which the partial prerendering fixture imports (`fixtures/next-ppr/app/(ppr)/layout.tsx`), and `pnpm smoke:packed` checks that both give the same component.

The files of the server components routes of the fixture, `fixtures/next-app/app/(csp-server)`:

| File                  | What it holds                                                      |
| --------------------- | ------------------------------------------------------------------ |
| `style.ts`            | The style, made once, which the server and the browser both import |
| `layout.tsx`          | The root layout: `StyleRegistry`, `ThemeProvider`, `Global`        |
| `parts.tsx`           | Styled server components                                           |
| `client.tsx`          | A styled client component                                          |
| `nonce.ts`            | Where the nonce of a request comes from. Only with a policy        |
| `proxy.ts` (app root) | The policy and a nonce for each request. Only with a policy        |

The fixture's `next.config.ts` lists the packages in `transpilePackages` because inside the repository they export TypeScript source. The published packages hold built code (see [Releasing](releasing.md)).

### The style module

`app/(csp-server)/style.ts`:

```ts
import { createStyle } from '@umber-style/react'
import { lightTheme } from '@umber-fixtures/shared/themes'

// The style of the server components under /csp-server, with a prefix of its own: every style element of
// these pages is one of server components, which carries the nonce of its request.
export const { styled, ThemeProvider, Global, keyframes } = createStyle(lightTheme, {
  prefix: 'cspsrv',
})
```

`lightTheme` is a plain object of colours, spaces and breakpoints (`fixtures/shared/src/themes.ts`). `createStyle(theme, { prefix })` makes it the base theme of the style, and each build of the binding reads it: the root layout, a server component, imports this module for the server components build, and `client.tsx`, a `'use client'` file, imports it too, so the browser bundle holds the same module with the same base theme. The module has to reach both sides:

- A class is named from the hash of its rules and the prefix, so the same style is the same class in both builds (check (iii) of `next-app.spec.ts`).
- A provider of a server component sends its theme to the browser as plain data. A client component below it reads that theme merged over the base theme of the client build, and takes from there what plain data cannot carry: the helpers hidden on `breakpoints`, functions (see [What crosses from the server to the browser](#what-crosses-from-the-server-to-the-browser), #81). The merge compares the raw values of the two themes, such as the sizes of `breakpoints`, before it takes a helper from below.
- A client component that reads a token below such a provider gets the same class in the first HTML, after hydration, after a client-side navigation to its page, and on the first request of a server just started: scenario (s3) and the test of a server started for it in `e2e/tests/next-app.csp-server.spec.ts` (#71).

### The root layout

`app/(csp-server)/layout.tsx`. The fixture's file also renders `<Hydrated />`, a marker that the tests wait for, left out here:

```tsx
import './nonce'
import { StyleRegistry } from '@umber-style/react/next'
import type { ReactNode } from 'react'
import { Global, ThemeProvider } from './style'

export const metadata = {
  title: 'UmberStyle server components with a nonce',
  icons: { icon: 'data:,' },
}

export default function CspServerLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StyleRegistry>
          <ThemeProvider theme={{ palette: { surface: '#efe9e3' } }}>
            <Global
              styles={(theme) => ({
                body: {
                  margin: 0,
                  backgroundColor: theme.palette.background,
                  fontFamily: 'sans-serif',
                },
              })}
            />
            {children}
          </ThemeProvider>
        </StyleRegistry>
      </body>
    </html>
  )
}
```

The first line registers the nonce source of [A strict content security policy](#a-strict-content-security-policy); an app with no policy leaves it out. The copy was type-checked against the fixture's packages with that marker removed.

- `StyleRegistry` goes once, around the page. It is a client component, which a server layout renders as any other. For each request it writes the styles that the request rendered with `useServerInsertedHTML`: the first piece in the head, each later piece of the stream at the top of the body, before that piece ([A registry for the Next.js App Router](cache-and-server.md#a-registry-for-the-nextjs-app-router)). In the HTML as sent no style element is among the elements of the page and every rule comes before the first element that uses it (scenario (r)).
- The layout is a server component, so this `ThemeProvider` is the server components build (the package picks it by the `react-server` export condition). With no provider above it in the page it renders no element and declares its theme on `:root`: the base theme, with the `surface` it was given over it.
- An app with no policy can leave the registry out: the routes under `(app)` have none, and the shared scenarios A to N pass on them. Without it both builds render `<style href precedence>` elements that React moves to the head. In a request with no nonce the registry leaves the server components to React the same way and takes the rules of the client components only (scenario (w)). Under a nonce policy the registry is what keeps the styles of server components out of the elements of the page (see [What the policy covers](#what-the-policy-covers)).

### A server component and a client component

A styled server component, from `app/(csp-server)/parts.tsx`:

```tsx
import { keyframes, styled } from './style'

/** A card of the home page. */
export const HomeCard = styled('section', { name: 'CspServerHomeCard' })(({ theme }) => ({
  paddingLeft: 16,
  borderWidth: 2,
  borderStyle: 'solid',
  borderColor: theme.palette.border,
}))
```

The page that renders it, `app/(csp-server)/csp-server/page.tsx` (`ServerFrame`, `List` and `Item` are styled the same way in `parts.tsx`):

```tsx
import { HomeCard, Item, List, ServerFrame } from '../parts'

// Rendered whole on the first load: the provider of the layout, `Global`, every class of the page, a list
// styled by the place of its items.
export default function CspServerPage() {
  return (
    <ServerFrame testId="page-csp-server" title="Server components with a nonce">
      <HomeCard data-testid="csp-server-home-card">Home</HomeCard>
      <List data-testid="csp-server-list">
        <Item data-testid="csp-server-item-1">One</Item>
        <Item data-testid="csp-server-item-2">Two</Item>
        <Item data-testid="csp-server-item-3">Three</Item>
      </List>
    </ServerFrame>
  )
}
```

A styled client component, `app/(csp-server)/client.tsx`, made with the same style (the fixture's file opens with a comment about its tests, left out here):

```tsx
'use client'

import { styled } from './style'

const Badge = styled('strong', { name: 'CspServerClientBadge' })(({ theme }) => ({
  display: 'inline-block',
  paddingLeft: 6,
  borderBottomWidth: 2,
  borderBottomStyle: 'solid',
  borderBottomColor: theme.palette.accent,
}))

/** A badge rendered by a client component. */
export function ClientBadge() {
  return <Badge data-testid="csp-server-client-badge">Client</Badge>
}
```

A server component renders it as any other component, `app/(csp-server)/csp-server/badge/page.tsx`:

```tsx
import { ClientBadge } from '../../client'
import { ServerFrame } from '../../parts'

// The page of the client badge, on a page of its own: the badge reads a token below the provider of the
// server build (#71), and the only client module of this style is loaded by this page, so its first
// request is the first time a server loads it, and a navigation to it is the first time the browser does.
export default function CspServerBadgePage() {
  return (
    <ServerFrame testId="page-csp-server-badge" title="Badge">
      <ClientBadge />
    </ServerFrame>
  )
}
```

The badge's class in the first HTML is its class after hydration, and its border has the accent of the theme (scenario (s3)).

### Global styles

The root layout above renders `Global` in a server component, with a function of the theme: the tokens are variables, so the `body` rule follows the theme declared on `:root`. The scenarios that compare the whole `body` with the page sent with no policy ((h), (p), (s)) read its computed background and margin. A `Global` works the same in a client component, in a server component and in a client component that streams late: the promo pages under `(app)` render it the three ways, and scenario M checks that its rule is there on the page, gone after a navigation away, and back once on return. A global rule that a page's server component wrote is gone after a navigation away from that page, and one that the root layout renders stays on every page (checks (vi) and (vii) of `next-app.spec.ts`). Under partial prerendering a page left by a navigation keeps its global rule; see [Partial prerendering](#partial-prerendering).

## Server components and client components

### What each one reads

| Component                                       | `useTheme()` and a function style read                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| A server component (no `'use client'` above it) | The base theme of the style, in every render: a full load or the partial render of a client-side navigation |
| A client component                              | The theme of the nearest provider, of either build, merged over the ones above                              |

A server component has no React context, and the request of a client-side navigation renders only the segment that changed, without the layouts above it. So it never sees a provider, and reads the base theme ([`useTheme()`: one name, one rule](server-rendering.md#usetheme-one-name-one-rule)). Check (iv) of `next-app.spec.ts` and the scenarios C19 and E29 of `e2e/helpers/providers.ts` run this on a full render and a partial one, with one component, `app/(scheme)/theme-probe.tsx`, rendered as both.

The tokens still follow the provider. A style function gets each token as a CSS variable (`var(--cspsrv-palette-surface)`), and the provider declares the variables of its own theme on `:root` or on its wrapper, so a server component below a nested provider takes that provider's colours, through the cascade. The scenarios of `e2e/helpers/providers.ts` check the computed colour under each provider after a full load, a client-side navigation, back and forward, a reload and with no script. What a server component reads as a real value (a breakpoint, a helper, a setting of your own) is the base theme's; read the nearest provider's real values in a client component.

### What crosses from the server to the browser

Only plain data crosses from a server component to a client component. A provider of a server component sends the part of its theme that is plain data: strings, numbers, booleans, `null`, lists and plain objects. A function (a style function under `components`, a helper under an enumerable key), a symbol or a class instance is left out, and in development the provider warns once with the paths (`packages/react/src/providerScope.server.test.tsx`):

```text
[sd] A ThemeProvider of a server component was given a theme with members that cannot cross to a client component: palette.mix, palette.shade, breakpoints.1, components.Button.styleOverrides, marker. They are left out of the theme that client components read below it, where these members keep the values of the theme above.
```

A client component below reads those members from the theme below the provider in the browser: the provider above it in the page, else the base theme of the client build, which is why the style module is imported on both sides. Members that are not enumerable, such as the helpers a design system hides on `breakpoints`, are not sent and not warned about: Next.js prints no "Only plain objects can be passed to Client Components" for the theme. The fixture's helpers page does this. Its style, `app/(csp-server)/helpers-style.ts`:

```ts
import { createStyle } from '@umber-style/react'
import { lightTheme } from '@umber-fixtures/shared/themes'

// The style of the helpers page under /csp-server, with a prefix of its own and a theme whose breakpoints
// carry helpers as a design system makes them: own members that are not enumerable, closures over the
// sizes. The server components of the page and its client component import this module, so the theme is
// registered on both sides, as the base theme of `createStyle`. Before #81 a server `ThemeProvider` given
// it sent the breakpoints with their helpers, and the development server printed "Only plain objects can
// be passed to Client Components" for each request.

const sizes = { sm: '600px', md: '840px' }

/** The breakpoints, with `up(key)`: the media query from the size of `key`. */
const breakpoints = { ...sizes } as typeof sizes & { up(key: keyof typeof sizes): string }
Object.defineProperty(breakpoints, 'up', {
  value: (key: keyof typeof sizes) => `@media (min-width:${sizes[key]})`,
  enumerable: false,
})

/** The theme of the helpers page: the light theme of the fixtures, with breakpoints that have helpers. */
export const helperTheme = { ...lightTheme, breakpoints }

export const { ThemeProvider, useTheme } = createStyle(helperTheme, { prefix: 'csphelp' })
```

The page, a server component, `app/(csp-server)/csp-server/helpers/page.tsx`:

```tsx
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
```

And the client component that calls the helper, `app/(csp-server)/helpers-client.tsx`:

```tsx
'use client'

import { useTheme } from './helpers-style'

/** The media query that a hidden helper of the theme's breakpoints gives, read in a client component. */
export function BreakpointQuery() {
  return <code data-testid="csp-server-helpers-query">{useTheme().breakpoints.up('md')}</code>
}
```

It shows `@media (min-width:840px)` in the first HTML and after hydration, and no "Only plain objects" message reaches the browser console, where the development server replays what it printed (scenario (x), both tiers).

The helper is taken from below only where the raw values of the provider's theme are those of the theme below. Where they differ, the helper is `undefined` below that provider rather than one built from other sizes, and in development the browser warns once for each path (`packages/react/src/crossedTheme.test.ts`):

```text
[umber] The theme of a server ThemeProvider has breakpoints.md = "900px", but the base theme of the client build has "840px": the client build does not have this theme. Register the same theme in a module the client loads, with getEngine().setTheme(theme), createStyle(theme) or configure({ theme }).
```

The two fixes are the ones the messages name. Register the theme you give the server provider in a module the client loads, as `helpers-style.ts` does. Or give the theme to a `ThemeProvider` in a client file, which passes its own theme object, functions included. The fixture's root provider of the shared app is one, `app/providers.tsx`, rendered by the root layout of `(app)` inside its server `ThemeProvider`:

```tsx
'use client'

import { ThemeProvider } from '@umber-fixtures/shared/style'
import { lightTheme } from '@umber-fixtures/shared/themes'
import type { ReactNode } from 'react'

// The client build of the root provider: client components read their theme from its context. It
// imports the theme itself, because a theme holds functions and cannot cross as a prop.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={lightTheme} colorScheme="light" isRoot>
      {children}
    </ThemeProvider>
  )
}
```

The rules of the merge, and what a list or a token does in it, are in [Hidden members](server-rendering.md#hidden-members-helpers-on-breakpoints).

### Styles stay on their side

A style does not cross from a server component to a client component. React turns the props of a client component into data, and an entry of `useStyle(sheet)`, an entry of an object sheet, a handle (`sheet.card`), a `css()` value or a class name (`String(entry)`) arrives without its CSS: the client component's element is unstyled. A styled server component given a handle or an entry is styled, and so is a client component that imports the sheet itself. To let a server component choose the style of a client component, pass a plain value:

The sheet, imported by both sides (`fixtures/next-app/app/(csp-server)/sheets.ts`, shortened):

```ts
export const sheet = StyleSheet.create((theme) => ({
  card: {
    paddingLeft: 31,
    borderLeftWidth: 3,
    borderLeftStyle: 'solid',
    borderLeftColor: theme.palette.accent,
  },
  label: { paddingLeft: 43, color: theme.palette.accent },
}))
```

The client component chooses the style from a plain value (`sheets-client.tsx`):

```tsx
'use client'

import { sheet } from './sheets'
import { styled } from './style'

const Card = styled('section', { name: 'CspServerSheetCard' })({ display: 'block', marginTop: 2 })

/** A card whose style the server component chooses with a plain value: the way to do it. */
export function ClientPicked({ tone }: { tone: 'card' | 'label' }) {
  return (
    <Card data-testid="sheets-client-picked" style={sheet[tone]}>
      picked
    </Card>
  )
}
```

And the server component passes the value, not the style (`csp-server/sheets/page.tsx`):

```tsx
<ClientPicked tone="card" />
```

In development, a styled client component given what a style became when it crossed warns once for each key, in its server render and in the browser (here for the entry of `StyleSheet.create({ card: { color: 'red' } }).card` under the prefix `umber`):

```text
[umber] A style was passed from a server component to a client component (--umber-entry-umber-bkhmwp), and its CSS cannot cross: import the sheet in the client component, and pass a plain value such as a string to choose the style.
```

React also prints its own development message for an entry or a handle given to a client component (an object with members of its own, "Only plain objects can be passed to Client Components from Server Components"). The slot pattern, an object of entries for the parts of a component, works within one side: a server component passing it to styled server components, or a client component to styled client components.

## A strict content security policy

A policy whose `style-src` has a nonce and no `'unsafe-inline'` lets in a `<style>` element only when it carries the nonce. On the App Router three things make the engine's elements carry it: a proxy that makes a nonce for each request and sends the policy, a nonce source that tells the server components build where to read it, and `StyleRegistry` in the root layout. The routes under `/csp-server` run this under `style-src 'nonce-<n>'; script-src 'self' 'nonce-<n>' 'strict-dynamic'`, with a new nonce for each request (scenario (j)).

### The proxy

`proxy.ts`, at the root of the app: the file Next.js runs before a route (the `middleware` file convention, renamed `proxy`), as the framework's guide sets one up (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`). The fixture's file also has the `control` switches of its tests (`?control=no-policy`, `no-cache-nonce` and `no-source`, or a `csp-control` cookie, described in its comment), left out here; the copy was type-checked against the fixture's packages without them:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { FIXED_NONCE } from './app/(csp-fixed)/nonce'

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete('x-nonce')
  const isFixed = request.nextUrl.pathname.startsWith('/csp-fixed')
  const nonce = isFixed ? FIXED_NONCE : Buffer.from(crypto.randomUUID()).toString('base64')
  const isDevelopment = process.env.NODE_ENV === 'development'
  const evaluation = isDevelopment ? " 'unsafe-eval'" : ''
  const policy = `style-src 'nonce-${nonce}'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${evaluation}`
  if (!isFixed) requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('content-security-policy', policy)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('content-security-policy', policy)
  return response
}

export const config = {
  matcher: [
    '/csp',
    '/csp/:path*',
    '/csp-server',
    '/csp-server/:path*',
    '/csp-inplace',
    '/csp-inplace/:path*',
    '/csp-fixed',
    '/csp-fixed/:path*',
    '/edge',
    '/edge/:path*',
  ],
}
```

The nonce goes into the policy of the response and into two headers of the request: `Content-Security-Policy`, from which Next.js takes the nonce of its own scripts, and `x-nonce`, which the nonce source reads. The development server needs `'unsafe-eval'` for React's debugging. The routes under `/csp-fixed` get one fixed nonce and no `x-nonce` ([One fixed nonce](#one-fixed-nonce)). An app with one design keeps one branch.

### The nonce source

`app/(csp-server)/nonce.ts`, which the root layout imports on its first line. The fixture's file also gives nothing for the `no-source` switch of its tests, a line left out here:

```ts
import { setNonceSource } from '@umber-style/react'
import { headers } from 'next/headers'

setNonceSource(async () => {
  const requestHeaders = await headers()
  return requestHeaders.get('x-nonce') ?? undefined
})
```

The server components build calls the source once in each request and gives the answer to every style element that request renders: of a styled server component, of `Global` and of a provider. It is read in every request, whatever part of the tree renders, so the request of a client-side navigation, which does not render the root layout, gets its nonce too (scenario (l): every style element of the payload carries the nonce of its own request, in a full render and in the render of a navigation). Reading the headers also makes every page under it render for each request, which a nonce needs. How the source and `NonceStyles` work is in [Server components: a nonce for each request](server-rendering.md#server-components-a-nonce-for-each-request).

The client components need nothing more. The style has no nonce (a nonce for each request cannot be in a bundle made once), and in the browser a cache given no nonce takes the nonce of the page for the style elements it makes (`packages/react/src/nonce.test.tsx`, and `packages/core/src/nonce.browser.test.ts` under a real policy in Chromium).

### What the policy covers

With the proxy, the source and `StyleRegistry`, these pages have the computed styles of the same page sent with no policy, every style element carries the response's nonce, and the browser refuses nothing:

| Case                                                                                                  | Scenario   |
| ----------------------------------------------------------------------------------------------------- | ---------- |
| The HTML as sent: every style element with the nonce, another nonce in each request                   | (j)        |
| The HTML as sent: no style element among the elements of the page, each rule before its first element | (r)        |
| The first load, JavaScript on and off, with `:first-child`, `:nth-child(2)` and `& + &` of a list     | (s)        |
| A page that streams in three boundaries, one nested, JavaScript on and off                            | (s2)       |
| A class first shown in a fallback: no element shown before its rule, watched from the first byte      | (t)        |
| A client-side navigation after a page that streamed: a props class after the base class               | (u)        |
| A client-side navigation to a client component whose class no page loaded before                      | (s4)       |
| A client component whose state changes to a new class, and one that mounts after a click              | (s5), (s6) |
| A client component that reads a token, in the first HTML and after a navigation                       | (s3)       |

The negative controls fail as they should: with no nonce from the source the browser refuses the styles, before and after a navigation (k), and a style element injected with no nonce stays refused and unapplied (m).

Without `StyleRegistry` the styles of server components under a nonce are sent in place, as `<style nonce>` elements before what they style, and written into the head at hydration. The routes under `/csp-inplace` run that, scenarios (h) to (o). It is styled, but with JavaScript off the elements stay among the elements of the page and shift what `:first-child`, `:nth-child` and `+` match; the registry is the set-up to use ([Limits of Server rendering](server-rendering.md#limits)).

**The development server.** Under a strict policy the development tools of Next.js write style elements with no nonce, in the head and in the shadow root of `<nextjs-portal>`, and the policy refuses them. Those violations are the framework's: the suite tells them apart by their script (`next-devtools`, in `e2e/helpers/csp.ts`) and checks the engine's elements and the page's styles. The production build reports none.

### One fixed nonce

An app whose policy names the same nonce in every response gives it to the cache of its style and needs no source. `app/(csp-fixed)/nonce.ts`:

```ts
// The one nonce of every response under /csp-fixed: proxy.ts puts it in the policy, and `./style` gives it
// to the engine's cache. A fixed value is what an app has whose policy names the same nonce each time; it
// is not a secret here, as the fixture is a test of what the engine does with it.
export const FIXED_NONCE = 'Zml4ZWQtbm9uY2UtZm9yLXRoZS1maXR1cmU='
```

`app/(csp-fixed)/style.ts`:

```ts
import { createStyle } from '@umber-style/react'
import { lightTheme } from '@umber-fixtures/shared/themes'
import { FIXED_NONCE } from './nonce'

// The style of the server components under /csp-fixed, with a prefix of its own and a FIXED nonce on its
// cache: no request gives it another, so every style element of these pages carries the same one.
export const { styled, ThemeProvider, Global } = createStyle(lightTheme, {
  prefix: 'cspfix',
  nonce: FIXED_NONCE,
})
```

Every request then has a nonce, the cache's, and the server components build sends it exactly as a nonce of a source. The proxy above sends that value in the policy of every `/csp-fixed` response. The first load with JavaScript on (p) and off (p2), a client-side navigation (q) and the HTML as sent (r) are styled as with no policy, nothing refused. In the fixture the source of `/csp-server` is registered too, for the whole server, and answers `undefined` on these routes, which have no `x-nonce`: a source with no answer gives the request the cache's nonce. An app with no source registered at all is covered by the unit tests (`packages/react/src/nonceSource.server.test.tsx`).

### What blocks styles

- **A nonce the page does not allow.** A style given a nonce that is not the one of the response, or no nonce on a page that has none to lend, is refused. With the development checks the cache warns once, with what to do ([Content security policy](server-rendering.md#content-security-policy) lists the three messages).
- **A policy with `'self'` only.** `style-src 'self'` allows style sheets from files of the origin and no `<style>` element, and every rule of the engine is in a `<style>` element. The nearest run is (k): the same pages under a nonce policy with no nonce on the styles are refused.
- **A policy with hashes only.** `style-src 'sha256-...'` cannot allow a class made at run time: its text is not known when the page is sent. The classes the browser makes need a nonce (or `'unsafe-inline'`).
- **A cache that stores the HTML apart from its header.** A CDN or a service worker that serves a stored page under a new policy serves an old nonce, and every element with that nonce is refused, scripts included. Cache the HTML and its policy header together, or inject a fresh nonce on every response.
- **A page prerendered at build time.** See [Static pages](#static-pages).

## Static pages, partial prerendering and the edge runtime

### Static pages

A page that Next.js prerenders at build time is rendered with no request, so it cannot carry a nonce made for each request: neither the engine's style elements nor the framework's scripts have one. Every route of the fixture under a policy reads the request (the nonce source calls `headers()`, the layout of `/csp` does too), so each renders for each request. The case where the page is prerendered is (pc2), a known failure on the production build of `fixtures/next-ppr`: the static shell carries no nonce, the policy refuses the framework's scripts in it, and the page never hydrates. A page with no policy is prerendered as usual: the routes of the shared app pass scenarios A to N.

### Partial prerendering

Partial prerendering (`cacheComponents: true`, with `partialPrefetching`, in `next.config.ts`) is a switch of the whole app, so it has a fixture of its own, `fixtures/next-ppr`, run on Next.js 16.4.6 with `StyleRegistry` from `umber-style/react/next`. What works there, on the production build and on the development server:

- `/ppr` is sent with a static shell from the build and a part that waits for the request (`connection()`) and streams in (p1).
- The first load is styled with JavaScript on, the shell and the part streamed (p2), and off, the shell and the fallback; the part streamed stays hidden, as with any boundary and no script (p3).
- Every rule of the shell is in the HTML before its first element, and every rule of the part streamed is in the HTML (p4).
- A client-side navigation and back keep both pages styled (p5), and the shared scenarios run on the pages of the shared app.
- Under a strict nonce policy every style element of the engine carries the nonce of the response and the policy refuses none (pc1). That route uses a cache with the nonce of the request, read inside a `Suspense` boundary, and client components only (`fixtures/next-ppr/app/(ppr-csp)/layout.tsx` and `providers.tsx`).

What does not work:

- **A nonce source.** `setNonceSource` is one for the whole server. Once a module registers it, every styled server component of every route reads the request through it, which under partial prerendering waits for the request: the build of a route whose styled server components are outside a `Suspense` boundary fails (`Route "/": Next.js encountered uncached or runtime data during prerendering`, seen by hand on the home page of the fixture, which renders no policy at all), and inside one they leave the static shell. Use the cache of the request, as the policy route of the fixture does.
- **Hydration under a nonce policy.** The shell is prerendered with no nonce, so the page never hydrates under the policy (pc2, a known failure on the production build; it passes on the development server, which prerenders nothing). Next.js documents partial prerendering as incompatible with a nonce policy.
- **Each rule once.** The registry writes the rules of the client components of the shell at build time, and the render of the request renders those components again and writes them again: their rule is in the head twice (p6, a known failure). Only bytes; the rule is the same.
- **`Global` on a page left by a navigation.** Next.js keeps the page a client-side navigation leaves in the document, hidden by a React `Activity`, instead of unmounting it. React does not clean up the insertion effect of a `Global` while its page is hidden, so the global rule of the page left stays on the page reached, until the page left is removed. Scenarios M (`M:promo:left`, `M:promo:reached`), B and C (which read the hidden page too) are known failures of `next-ppr` in `e2e/fixtures.ts`.

### The edge runtime

A root layout with `export const runtime = 'edge'` renders every page below it on the edge runtime, which Next.js 16 deprecates and still builds. The routes under `/edge` have the root layout of `/csp-server` with that line (`app/(edge)/layout.tsx`): the same nonce source, imported from `../(csp-server)/nonce` into the edge bundle, the same style, `StyleRegistry` and a client component, under the policy of the proxy above. On 16.3 and 16.4, production build and development server:

- Every page prints `edge` for `process.env.NEXT_RUNTIME` (e1).
- The first load with JavaScript on and off is styled as with no policy, every style element with the nonce, none in place, nothing refused (e2).
- In the HTML as sent no style element is among the elements of the page and every rule comes before its first element, with the nonce; the later piece of a page that streams brings its rules at the top of the body (e3).
- A client-side navigation to a page with classes of its own (e4) and a page that streams (e5) are styled as with no policy, nothing refused.

## What the registry and the bundle cost

**The registry.** On pages of the same content, the server time of a request was about 0.25 to 0.3 ms longer with `StyleRegistry` than with the styles in place (median 2.38 against 2.15 ms, 1000 requests each, two runs, the server on one CPU). A page with one `useServerInsertedHTML` callback that inserts nothing costs the same: Next.js renders the callbacks once for each flush of the stream (12 for these pages) even when they return nothing, and the registry's own work is about 10 microseconds. The HTML is a little smaller with the registry: 21,058 bytes against 21,696 for the fixture's home page, 30,788 against 31,524 for the page with three boundaries. The figures are in the Limits of [Server rendering](server-rendering.md#limits).

**The client chunk.** On 0.8.0 a page of a Next.js app could load one more script in its first HTML than on 0.7.0. The code that the entries of `@umber-style/core` share was exported under minified names and re-exported renamed; Turbopack adds a module for each renamed name a binding imports, and those modules pushed the chunk of the React binding past the size at which Next.js merges chunks. 0.9.0 keeps the names (`minifyInternalExports: false` in the `tsdown.config.ts` of `core` and `is-prop-valid`), and the code is the same. On a design system's Next.js 16.4.6 App Router app, its two pages load 10 and 9 scripts again, against 11 and 10 on 0.8.0 (release notes of `@umber-style/core` 0.9.0, #84). `pnpm smoke:packed` fails when a shared file of a package is built with minified export names again (`scripts/smoke-packed.mjs`, `scripts/shared-exports.test.mjs`).

## Limits

- Everything on this page ran in Chromium only. Firefox and WebKit were not run.
- The fixtures consume the workspace source, through `transpilePackages`. A Next.js app built with the packages installed from npm was not run in this repository: `pnpm smoke:packed` loads `@umber-style/react/next` and `umber-style/react/next` from the tarballs in Node, with a stand-in for `next`.
- The fixtures run the React that Next.js bundles. What the React an app installs would do on the App Router is not observed, on any row.
- Partial prerendering runs on Next.js 16.4.6 only, the lockfile's; the CI rows of 16.3 run `next-app`, not `next-ppr`. The edge runtime runs on both rows.
- The build failure of a nonce source under partial prerendering was seen by hand on the fixture's home page; no test runs it, since the fixture is built so that it does not happen.
- A fixed nonce on a page prerendered at build time was not run: in the fixture the nonce source is registered and reads the request, so `/csp-fixed` renders for each request.
- The policies with `'self'` only or hashes only for styles, and a cache that stores the HTML apart from its header, were not run: what they do follows from the policy.
- The cost of the registry was measured once, by hand, on the fixture's pages; no benchmark runs it. The script counts of #84 come from an app outside the repository; what the repository checks is the export names of the packed files.
- On the development server the development tools of Next.js report violations of a strict policy that are not the engine's (above).
- The elements of `StyleRegistry` for the later pieces of a stream stay at the top of the body after hydration; they are not moved into the head.
- With JavaScript off, a page that streams shows the fallback of each `Suspense` boundary and never its late content, under a policy or not: that takes React's script.
- A page that renders one styled component from a server component and from a client component, under `StyleRegistry` in a request with no nonce, was not run ([Limits of The cache and server packages](cache-and-server.md#limits)).
- Other frameworks with server components were not run.
- A plain element in a server component given a handle in `style` writes nothing and raises no error (the client build throws): the handles of the server components build hold `null` in their key, because React reads every key of a prop for its development messages, and a key that throws made the page fail on the development server. The types reject it.
- A style passed from a server component to a client component is unstyled; the warning that says so is given in development only, for an object of one key.
