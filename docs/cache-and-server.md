# The cache and server packages

After this page you can make a cache with `@umber-style/cache` and know each of its members, give a subtree its cache with `CacheProvider` (in another document too, such as an iframe), collect the rules of a request in a registry for the Next.js App Router, render a static or server page with `@umber-style/server/create-instance`, and say what a browser cache does with the style elements they write.

The bindings render on a server without these two packages: see [Server rendering](server-rendering.md). Use them when your set-up collects the rules itself, keyed by a cache: a registry that writes a `<style data-umber>` element as the stream goes, or a server that sends the CSS of a page in chunks.

| Package                               | What it is                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `@umber-style/cache`                  | `createCache({ key })`: the engine's cache, keyed by `key`, with the members a set-up reads and wraps               |
| `@umber-style/server/create-instance` | `createInstance(cache)`: the CSS that one page needs, as chunks, as `<style data-umber>` tags, or put into the HTML |

Both are default exports, and named ones too, the same function (`import { createCache } from '@umber-style/cache'`, `import { createInstance } from '@umber-style/server/create-instance'`): a library that ships a CommonJS build imports them by name, see [A library that ships a CommonJS build](react.md#a-library-that-ships-a-commonjs-build). Both depend on `@umber-style/core` only.

## `createCache`

```ts
import createCache from '@umber-style/cache'

const cache = createCache({ key: 'app' })
const box = cache.css({ color: 'red' })
```

`box` is `'app-bkhmwp'`, and `cache.inserted` is `{ 'app-layers': true, 'app-bkhmwp': true }` (`index.node.test.ts`).

`createCache` returns the cache of `@umber-style/core` (`css`, `extract()`, `getRules` and the rest), with `key` as its prefix and these members added:

| Member                                             | What it is                                                                                                                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`                                              | The key it was made with. It is the prefix: the first part of every class name and variable, and the first word of `data-umber`                                                   |
| `compat`                                           | `false` by default. Set it to `true` and `inserted` holds the CSS text of each group of rules instead of `true`                                                                   |
| `inserted`                                         | Each group of rules written since the cache was made, by name: its CSS text with `compat`, else `true`. The names of the `data-umber` elements on the page at start-up are `true` |
| `insert(selector, serialized, sheet, shouldCache)` | Called by the cache after it writes a group of rules: `selector` is `''`, `serialized` is `{ name, styles }`, `shouldCache` is `true`. It records the group in `inserted`         |
| `registered`                                       | The style object of each class the cache made, a `Map`: `registered.get(className)`. Read by class name, `registered[className]` is `true`                                        |
| `sheet.tags`                                       | The style elements that hold the rules of the cache, in document order: its own and those on the page with its key. `[]` without a document                                       |

The types are exported: `UmberCache` (the cache), `UmberCacheOptions`, `SerializedRule` (`{ name, styles }`) and `UmberSheet`. `UmberCache`, `SerializedRule` and `UmberSheet` are declared in `@umber-style/core`, with the other types apps import, and re-exported here, by `@umber-style/react`, `@umber-style/vue` and `@umber-style/css`: one type, whichever package a file imports it from.

The options are those of the core's `createCache` (see [Options reference](options.md)), with `key` for `prefix` and without `onInsert`, which the package uses itself. `speedy` is the option of the core, with the meaning that an app moving from the styling library it used already gives it: `speedy: true` writes the rules with `insertRule`, `speedy: false` writes each rule as the text of a style element of its own, readable through `textContent` (see [`speedy`](options.md#speedy)). Without it, the rules are text outside production and go in with `insertRule` in production. `nonce` is the nonce of a content security policy: the cache's own style element in the browser carries it, it is `cache.nonce`, and the tags of `createInstance` below carry it (see [Content security policy](server-rendering.md#content-security-policy)). A key is lowercase letters, digits and hyphens, starting with a letter; another throws:

```text
Error: Invalid cache prefix "Bad Key": use lowercase letters, digits and hyphens.
```

Give the cache to a subtree with `CacheProvider` (below), to an engine with `createEngine(theme, { cache })`, or to a binding with `createStyle(theme, { cache })`.

### What `insert` sees

Replace `insert` with a function that calls the one it replaces, and it sees each new group of rules once. From the tests of the package (`index.test.ts`, `renderPage` and `wrapInsert`):

```ts
import createCache from '@umber-style/cache'
import { createEngine } from '@umber-style/core'

const theme = { palette: { primary: '#0000ff', accent: '#ff0000' }, space: [0, 4, 8] }

const cache = createCache({ key: 'app' })
cache.compat = true
const prevInsert = cache.insert
cache.insert = (...args) => {
  const serialized = args[1]
  // serialized.name, serialized.styles
  return prevInsert(...args)
}

const engine = createEngine(theme, { cache })
const themeClass = engine.themeClass(theme, 'light')
const fade = engine.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
const box = engine.css({ color: engine.refs.palette.primary, animation: `${fade} 1s` })
engine.insertGlobal({ body: { margin: engine.refs.space[1] } })
```

`cache.inserted` is then, in the order the groups were written:

```json
{
  "app-layers": "@layer app-theme,app-global,app-components,app-overrides;",
  "app-theme-1u39y9v": "@layer app-theme{.app-theme-1u39y9v{color-scheme:light;}}",
  "@keyframes:keyframes-1acbpvw": "@keyframes keyframes-1acbpvw{0%{opacity:0;}100%{opacity:1;}}",
  "app-5jg77": "@layer app-components{.app-5jg77{color:var(--app-palette-primary);animation:keyframes-1acbpvw 1s;}}",
  "app-theme-1u39y9v-beaiho": "@layer app-theme{.app-theme-1u39y9v{--app-palette-primary:#0000ff;}}",
  "app-global-1pbfzrw": "@layer app-global{body{margin:var(--app-space-1);}}",
  "app-theme-1u39y9v-4f4vee": "@layer app-theme{.app-theme-1u39y9v{--app-space-1:4px;}}"
}
```

| Name                          | The group                                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `<key>-layers`                | The layer order statement, once                                                                                   |
| A class                       | The rules of that class                                                                                           |
| A theme class                 | Its rule the first time; each time variables are added to it (pruning), what is added, under `<class>-<hash>`     |
| `<key>-root-<hash>-<hash>`    | The rule of the root theme on `:root`: its id and a hash of its text, so each time it is written anew, a new name |
| `<key>-global-<hash>`         | A set of global rules                                                                                             |
| `@keyframes:<name>`           | A `@keyframes` rule                                                                                               |
| `@property:<variable>:<hash>` | A `@property` rule                                                                                                |

Each group is reported once: a second `css` of the same style writes nothing and calls nothing. A rule that the page already has is not written, so it is not reported either. A call with `shouldCache` `false` records nothing. Two caches keep their rules apart.

## `CacheProvider`: a cache for a subtree

`<CacheProvider value={cache}>` gives the subtree below it its cache. It is exported by `@umber-style/react` (the client build) and by `@umber-style/vue`; on React Native it renders its children, so that one source compiles for both platforms. The server components build has no context, and so no `CacheProvider`.

```tsx
import createCache from '@umber-style/cache'
import { CacheProvider, styled, ThemeProvider } from '@umber-style/react'

const theme = { palette: { primary: '#0000ff' } }
const cache = createCache({ key: 'soroush' })
const Box = styled('p', { name: 'Box' })(({ theme: view }) => ({ color: view.palette.primary }))

export function App() {
  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <Box />
      </ThemeProvider>
    </CacheProvider>
  )
}
```

Under it, everything the binding writes goes to `cache` and nowhere else: the classes of styled components (the base, props, override and held classes), the entries that `useStyle` returns and `apply` of them, sheet entries and `css()` values given to the `style` of a styled component, `Global`, keyframes, the root theme rule and the theme classes of the providers below. Outside any provider nothing changes. `packages/react/src/CacheProvider.test.tsx` and `packages/vue/src/CacheProvider.test.ts` check each of these, with a sibling outside the provider, nested providers (the nearest one wins), unmounting (global rules and held classes leave the given cache) and, in React, hydration.

**The engine of a cache.** A styled component is made once, at module scope, by the engine of its style. Under a provider it makes its class with the engine of the same theme over the given cache (`engine.withCache(cache)`, see [Plain JavaScript](plain-javascript.md)), which is made once for each cache and kept while the cache lives; the component keeps one styler for each such engine. That engine has the token options of the style (modes, raw and length keys, registered tokens, `alwaysDeclare`) and the prefix of the cache, for classes and variables alike: under a cache with the key `soroush`, a token is `var(--soroush-palette-primary)`. The engines share one base theme. An option that describes how the author wrote the styles follows the style: the engine over the cache keeps the value the style was given (by `createStyle`, `configure` or the engine options), and an option the style was not given is the cache's. An option that says how classes are named or where and how rules are stored is the cache's. So `createCache({ key })` with nothing else is enough: a style configured with `hasValueRepair: true` repairs its values under the provider too.

| Option                                                          | Follows   | Why                                                                                                                                                                         |
| --------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rawKeys`, `lengthKeys`, `modes`, `registered`, `alwaysDeclare` | the style | They decide what a token is in the author's styles                                                                                                                          |
| `hasValueRepair`                                                | the style | The author wrote `var(--x)1F` and `-var(--x)` for it: without it the declaration is invalid and the browser drops it                                                        |
| `hasColorFallbacks`                                             | the style | How the author's `alpha()` values are written                                                                                                                               |
| `hasBaseClass`                                                  | the style | How a component's style list is split into classes                                                                                                                          |
| `hasDevChecks`                                                  | both      | The engine's own checks (what a style function returns, global styles) follow the engine's option; the cache's checks (the page, `CSS.supports`, values) follow the cache's |
| `prefix`                                                        | the cache | Classes and variables use the cache's prefix                                                                                                                                |
| `suffix`, `hasLabels`                                           | the cache | How the cache names its classes                                                                                                                                             |
| `hasLayers`, `hasPruning`, `hasScope`                           | the cache | How and where the cache stores its rules and themes                                                                                                                         |
| `speedy`, `sheet`, `onInsert`                                   | the cache | Where the rules go                                                                                                                                                          |

An engine given a `cache` directly (`createStyle(theme, { cache })`) follows the same table, and with the development checks it warns once, naming each option of the cache column that it was given: the cache decides those, and they are ignored. A class is named from the rules it writes, so the same styles written with value repair and without it are two classes, each with its own rule. The stamp of the options that a server writes is the cache's (`cache.fingerprint`): the style options of an engine over a provided cache are not in it, as its token options are not, because they come from the same module code on the server and in the browser. Labels are the cache's (`hasLabels`, on by default in both): a class has a label when its style has one (the `name` or `label` of `styled`, a `label` key), under a provider or not; a `css()` value or a plain object without a `label` key gives a class without one. The tests are `createEngine.withCache.test.ts` and, with the set-up of an app (`createCache({ key })`, `CacheProvider`, `configure`, `@umber-style/server`), `appSetUp.test.tsx` of the server package.

**The default cache of an app.** The app above never calls `configure`: its class names and variables have the prefix `soroush` everywhere, and the cache of the default engine stays empty (`CacheProvider.test.tsx`, "the default cache of an app"). In development the default style warns once there, because a default style that was never configured under a cache of another key is also what a `configure` call that did not run looks like: call `configure` (with the key as its `prefix`, or any option) to say the set-up is meant. See [A library that wraps the engine](react.md#a-library-that-wraps-the-engine).

**Entries made at module scope.** A sheet entry or a `css()` value belongs to the cache that made it. Given to the `style` of a styled component under a provider, it is written into the provider's cache, under a class of that cache, from its style (`cache.adoptEntry`). For a plain element, read the sheet with `useStyle(sheet)` under the provider: it returns entries of the provider's cache, and `apply` writes an entry into the cache that made it.

**The theme.** A `ThemeProvider` under a `CacheProvider` whose nearest provider above has another engine (it is outside the `CacheProvider`) is the outermost one of its cache: it renders no element and declares its theme on `:root` in that cache. Put one in each subtree that has a cache of its own, so that the variables of its prefix are declared there.

**Server rendering.** Under a `CacheProvider` the client build renders no `<style href precedence>` element and no stamp, whatever `hasServerStyleElements` says: the app sends the rules of its cache itself, through a registry or `@umber-style/server`. A `Global` there renders one element, the marker of its sets, `<meta name="<key>-global" content="<ids>">`, which React moves to the head: `@umber-style/server` reads it, so that the global rules of a `Global` are in the CSS of the page that rendered it only. A registry sends what the request writes and does not need it. The browser renders no marker, and a hydration skips the one the server sent (`registry.test.tsx`). This holds for any `CacheProvider`, also one given the cache of the style itself: a cache handed to a subtree is one the app collects, and the elements that React hoists go to the head of the main document, which is not the document of a subtree rendered into an iframe.

**The cost.** Until the first `CacheProvider` renders, no component reads its context: a component with only object styles calls no hook, as before. From then on each styled component, `Global`, `useStyle` and `ThemeProvider` read the cache with `use`, which React allows to start being read in a component that is mounted already, so the order of its hooks does not change (`CacheProvider.order.test.tsx`).

### Another document

A cache serves the document of its sheet. `createDomSheet(key, container)` looks up and creates its `<style data-style="key">` element in the document of `container`, and a cache made over that sheet reads that document: the style elements a server left there, the stamp of the options, the elements that arrive later, and in development the check of the page. A subtree rendered into an iframe through a portal, under a provider of such a cache, gets its rules in the iframe. From `packages/react/src/CacheProvider.browser.test.tsx`:

```tsx
import { createCache, createDomSheet } from '@umber-style/core'
import { CacheProvider, createStyle } from '@umber-style/react'
import { createPortal } from 'react-dom'

const theme = { palette: { text: '#ff0000', surface: '#00ff00' } }
const frame = iframe.contentDocument as Document
const frameCache = createCache({ prefix: 'frame', sheet: createDomSheet('frame', frame.head) })
const style = createStyle(theme, { prefix: 'main' })
const Text = style.styled('p', { name: 'Text' })(({ theme: view }) => ({
  color: view.palette.text,
  background: view.palette.surface,
}))

const tree = (
  <style.ThemeProvider theme={theme}>
    <Text>main</Text>
    <CacheProvider value={frameCache}>
      {createPortal(
        <style.ThemeProvider theme={theme}>
          <style.Global styles={{ body: { margin: 0 } }} />
          <Text>framed</Text>
        </style.ThemeProvider>,
        frame.body
      )}
    </CacheProvider>
  </style.ThemeProvider>
)
```

In headless Chromium the framed text has the class `frame-text-root-<hash>` and the computed colour and background of the theme, the iframe's `<html>` has `--frame-palette-text`, its `<body>` has no margin, no style element of the iframe holds a `main-` rule and none of the page a `frame-` rule. The two caches render at once, with one theme.

## A registry for the Next.js App Router

In the App Router the styles of a request are written into the stream with `useServerInsertedHTML`, which the framework calls each time it sends a piece of the page. `@umber-style/react/next` has a registry that does it: add `StyleRegistry` once, around the page, in the root layout. This is the root layout of the server components routes of the App Router fixture, `fixtures/next-app/app/(csp-server)/layout.tsx`, as the end-to-end suite runs it (Next.js 16.4.6, production build and development server):

```tsx
import './nonce'
import { Hydrated } from '@umber-fixtures/shared/interactive'
import { StyleRegistry } from '@umber-style/react/next'
import type { ReactNode } from 'react'
import { Global, ThemeProvider } from './style'

export const metadata = {
  title: 'UmberStyle server components with a nonce',
  icons: { icon: 'data:,' },
}

// A root layout of its own for the routes under /csp-server, which proxy.ts sends with a strict policy
// and a new nonce for each request. Everything styled here is a server component but one badge; the nonce
// of each request comes from the source that `./nonce` registers, not from a prop of this layout, so the
// request of a client-side navigation, which does not render this layout, gets it too. `StyleRegistry`
// writes the styles of the request in the head and before each later piece of the stream.
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
        <Hydrated />
      </body>
    </html>
  )
}
```

`StyleRegistry` is a client component; a server layout renders it as any other. It makes a registry for each request, and in the server render of the first HTML it collects:

- The styles of the server components, in a request that has a nonce (from `setNonceSource` or the cache, see [Server components: a nonce for each request](server-rendering.md#server-components-a-nonce-for-each-request)): with the registry nothing is in place among the elements of the page. In a request with no nonce React hoists their `<style href precedence>` elements, the same with the registry as without it.
- The styles of the client components: the classes, the root theme and the global rules each style writes, from the engine's own cache (with no `cache` prop), or, given a `cache`, every rule that cache writes, which `StyleRegistry` then gives to the client components below with a `CacheProvider`, as the registry below does.

Each flush writes what the request rendered since the flush before, each rule once in the request: `<style nonce data-umber="<prefix> <name>..." data-umber-registry>`, one element for each prefix and nonce. The framework puts the first one in the head and each later one at the top of the body, before the piece of the stream it styles, so a rule always comes before the first element that uses it. Each text carries the nonce it came with: the request's, from a source or the cache; there is no nonce prop. A text that came with none (a client component of a style with no nonce of its own) gets the nonce of the request when another text of the request came with one. In the browser the engine's cache reads these elements as rules of the page and writes none of them again; hydration leaves them where they are, and React prints no warning.

On the fixture's streaming page under the policy, with three `Suspense` boundaries (one nested), the HTML as sent holds four elements of the registry, the first in the head and three at the top of the body: each class has its rule before its first element, in one element only, and no style element is inside an element of the page. The class of a tag first shown in a fallback is in the element of the first piece, so it is styled when the content replaces the fallback; with the styles in place (no registry), the same page showed it with no rule for one frame when the content replaced the fallback (seen on the fixture with the watch of scenario (t) of `e2e/helpers/cspServer.ts`; 22 to 30 ms on the prototype of the registry). A client-side navigation sends no HTML: the browser writes the rules of the new page with the nonce of the document after the last style element of the engine in document order, so a props class comes after the base class that a later piece put at the top of the body.

With a cache of the request, the providers file of the fixture's routes under `/csp` (`fixtures/next-app/app/(csp)/providers.tsx`), which the root layout of those routes renders around the page with the nonce it read from the request:

```tsx
'use client'

import createCache from '@umber-style/cache'
import { StyleRegistry } from '@umber-style/react/next'
import { Global, ThemeProvider } from '@umber-fixtures/shared/style'
import { darkTheme, lightTheme } from '@umber-fixtures/shared/themes'
import { useState, type ReactNode } from 'react'

// The providers file of the routes under /csp, under a strict content security policy: a cache for each
// request with the nonce of the response, given to `StyleRegistry`, which gives it to the client
// components below and writes the rules it gets with that nonce. The nonce comes as a prop from the
// server layout, which read it from the request; in the browser the same prop gives the browser's cache
// its nonce, so the rules it writes after hydration are let in too. app/(registry)/providers.tsx keeps a
// registry written by hand.
//
// As in the registry, a button gives the outermost provider the dark theme: the browser's cache then
// writes the rules of that theme, after hydration, under the policy.
export default function Providers({
  nonce,
  children,
}: Readonly<{ nonce?: string; children: ReactNode }>) {
  const [cache] = useState(() => createCache({ key: 'umber', nonce }))
  const [theme, setTheme] = useState(lightTheme)
  return (
    <StyleRegistry cache={cache}>
      <ThemeProvider theme={theme}>
        <Global
          styles={(theme) => ({
            '*, *::before, *::after': { boxSizing: 'border-box' },
            body: {
              margin: 0,
              backgroundColor: theme.palette.background,
              color: theme.palette.text,
              fontFamily: 'sans-serif',
            },
          })}
        />
        {children}
        <button type="button" data-testid="csp-theme-switch" onClick={() => setTheme(darkTheme)}>
          Dark
        </button>
      </ThemeProvider>
    </StyleRegistry>
  )
}
```

With a cache, the output is the output of the registry an app writes by hand (below), with `data-umber-registry` on the element: `packages/react/src/next.test.tsx` renders the page of the unit test below with both and compares them.

`next` is an optional peer dependency of `@umber-style/react` (`^16.4.6`: from 16.4.6, the version the fixture runs, before 17); only this entry imports it. Partial prerendering and the edge runtime were not tested.

### Or write your own

A client component can collect the rules that a request writes and send them with `useServerInsertedHTML` itself. This is the providers file of the App Router fixture that keeps one, `fixtures/next-app/app/(registry)/providers.tsx`, as the end-to-end suite runs it (Next.js 16.4.6, production build and development server):

```tsx
'use client'

import createCache from '@umber-style/cache'
import { CacheProvider } from '@umber-style/react'
import { Global, ThemeProvider } from '@umber-fixtures/shared/style'
import { lightTheme } from '@umber-fixtures/shared/themes'
import { useServerInsertedHTML } from 'next/navigation'
import { useState, type ReactNode } from 'react'

// The providers file that apps copy, with this repository's packages: a cache for each request, whose
// new rules are flushed into the stream with useServerInsertedHTML, then the theme and the global rules.
// The key is the prefix of the style that the components are made with (`umber`).
function useStyleRegistry() {
  const [{ cache, flush }] = useState(() => {
    const cache = createCache({ key: 'umber' })
    cache.compat = true
    const prevInsert = cache.insert
    let inserted: string[] = []
    cache.insert = (...args) => {
      const serialized = args[1]
      if (cache.inserted[serialized.name] === undefined) inserted.push(serialized.name)
      return prevInsert(...args)
    }
    const flush = () => {
      const prev = inserted
      inserted = []
      return prev
    }
    return { cache, flush }
  })

  useServerInsertedHTML(() => {
    const names = flush()
    if (names.length === 0) return null
    let styles = ''
    for (const name of names) styles += cache.inserted[name]
    return (
      <style
        key={cache.key}
        data-umber={`${cache.key} ${names.join(' ')}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    )
  })

  return cache
}

export default function Providers({ children }: Readonly<{ children: ReactNode }>) {
  const cache = useStyleRegistry()
  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={lightTheme}>
        <Global
          styles={(theme) => ({
            '*, *::before, *::after': { boxSizing: 'border-box' },
            body: {
              margin: 0,
              backgroundColor: theme.palette.background,
              color: theme.palette.text,
              fontFamily: 'sans-serif',
            },
          })}
        />
        {children}
      </ThemeProvider>
    </CacheProvider>
  )
}
```

The root layout is a server component that renders `<html lang="en"><body><Providers>{children}</Providers></body></html>`, with no theme class on `<html>`. Each request makes its own cache (the state of the providers file), and each flush writes the names collected since the last one: a rule is sent once, a flush with nothing new returns `null`, and two requests each send the whole of what they use. In the fixture (`e2e/tests/next-app.registry.spec.ts`, the same checks in `e2e/dev-tests/registry.spec.ts`):

- The first flush is one `<style data-umber>` element in the head, with the layer order, the global rules of `Global` and the rule of the root theme. A part that streams in later through a `Suspense` boundary brings a second element, in the body, before the markup it styles, with only the groups that are new. With scripting disabled every class of the HTML has its rule in an element that comes before it.
- Hydration prints no warning, and writes no rule of the HTML again. The browser's cache removes the root rules that the server sent and writes its own, one live rule. A chunk that streams in after hydration brings a style element with the root rule the server wrote, with the theme of the request. It comes later in the document than the rule of the browser's cache, so before 0.3.0 a theme switched while the page was still streaming was undone when that chunk arrived, and stayed undone until the next declaration of the root theme. The cache now removes the root rules of such an element as it arrives, so the one rule stays the one: the fixture switches to a dark theme while the late part is still a fallback, and the page is still dark, the late part with it, once the part has arrived.
- A client-side navigation renders the new page in the browser, where the hook does nothing: the browser's cache writes the rules of the classes that only the new page has and its `@keyframes` rule, into its own `<style data-style>` element. The rules of the page that was left stay: the cache does not remove the rule of a class.
- Two requests rendered at the same time, with parts that have no class in common, each get the rules of their own part only.
- The same `key` on the element of every flush is fine: each flush is rendered on its own, React printed no warning in the browser or the server log, and the two elements of a streamed page are both in the document.

### With a nonce, under a strict policy

The routes under `/csp` of the same fixture run `StyleRegistry` with a cache of the request (the providers file above) under `Content-Security-Policy: style-src 'nonce-<n>'; script-src 'self' 'nonce-<n>' 'strict-dynamic'`, with a new nonce for each request and no `'unsafe-inline'` for styles (`e2e/tests/next-app.csp.spec.ts` on the production build, the same scenarios in `e2e/dev-tests/csp.spec.ts` on the development server). Three files do it.

The policy is made in `proxy.ts`, the file the framework runs before a route (the `middleware` file convention, which it renamed `proxy`), as its guide sets one up (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`). The nonce goes into the policy of the response, and into two headers of the request: `Content-Security-Policy`, from which the framework takes the nonce of its own scripts (it gives React's render that nonce as a string, which React takes as the script nonce only, so a `<style data-precedence>` element of React has none), and `x-nonce`, which the layouts read. The routes under `/csp-server` and `/csp-fixed` are sent the same way: they are server components, whose nonce comes from a source the app registers (or is fixed on the cache), under the same `StyleRegistry` in their root layouts (above); `/csp-inplace` renders the parts of `/csp-server` with no registry, and its styles are sent in place in the first HTML and written into the head with the document's nonce in the browser, so that this policy lets them in (see [Server components: a nonce for each request](server-rendering.md#server-components-a-nonce-for-each-request)). The `control` switches are the fixture's, for its tests:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { FIXED_NONCE } from './app/(csp-fixed)/nonce'

// The routes under /csp are sent with a strict content security policy, as the framework's guide sets
// one (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md): a new nonce for each
// request, in the policy of the response and in the request headers that the render reads. The
// framework takes the nonce of its own scripts from the `Content-Security-Policy` header of the request
// (it gives React's render that nonce as a string, which React takes as the script nonce only); the
// layouts read `x-nonce`. Styles have no 'unsafe-inline'. The development server needs 'unsafe-eval'
// for React's debugging.
//
// Three switches of the query, for the tests: `?control=no-policy` sends the same page with no policy and
// no nonce (what the styles are compared with), `?control=no-cache-nonce` keeps the policy and leaves the
// nonce off the cache (the negative control of /csp), and `?control=no-source` keeps the policy and makes
// the nonce source of /csp-server give nothing (its negative control). A `csp-control` cookie of the same
// value does the same for every request of the page. /csp-server is sent the same way. /csp-fixed is sent
// with the same nonce in every response (the fixed nonce that its engine's cache has) and no `x-nonce`
// request header, so the nonce source of /csp-server answers nothing there. /csp-inplace is sent as
// /csp-server is: the same parts with no registry.
export function proxy(request: NextRequest) {
  // The cookie keeps a switch for the requests of the client-side navigations of a page too.
  const control =
    request.nextUrl.searchParams.get('control') ?? request.cookies.get('csp-control')?.value
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete('x-nonce')
  requestHeaders.delete('x-csp-control')
  if (control === 'no-policy') {
    requestHeaders.delete('content-security-policy')
    return NextResponse.next({ request: { headers: requestHeaders } })
  }
  const isFixed = request.nextUrl.pathname.startsWith('/csp-fixed')
  const nonce = isFixed ? FIXED_NONCE : Buffer.from(crypto.randomUUID()).toString('base64')
  const isDevelopment = process.env.NODE_ENV === 'development'
  const evaluation = isDevelopment ? " 'unsafe-eval'" : ''
  const policy = `style-src 'nonce-${nonce}'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${evaluation}`
  if (!isFixed) requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('content-security-policy', policy)
  if (control === 'no-cache-nonce' || control === 'no-source') {
    requestHeaders.set('x-csp-control', control)
  }
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
  ],
}
```

The root layout of those routes is a server component. It reads the nonce from the request and gives it to the providers file as a prop, the one way a value of the request reaches a client component; reading the headers also makes every page under it render for each request, which a nonce needs:

```tsx
import { Hydrated } from '@umber-fixtures/shared/interactive'
import { headers } from 'next/headers'
import type { ReactNode } from 'react'
import Providers from './providers'

export const metadata = { title: 'UmberStyle registry with a nonce', icons: { icon: 'data:,' } }

// A root layout of its own for the routes under /csp, which proxy.ts sends with a strict policy. It is a
// server component: it reads the nonce of the request from the `x-nonce` header that the proxy set and
// gives it to the providers file as a prop, the one way a value of the request reaches a client
// component. Reading the headers makes every page under it render for each request, which a nonce needs.
export default async function CspLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers()
  const nonce = requestHeaders.get('x-nonce') ?? undefined
  // The negative control of the tests (`?control=no-cache-nonce`): the policy stays, the cache gets no nonce.
  const isCacheWithout = requestHeaders.get('x-csp-control') === 'no-cache-nonce'
  return (
    <html lang="en">
      <body>
        <Providers nonce={isCacheWithout ? undefined : nonce}>{children}</Providers>
        <Hydrated />
      </body>
    </html>
  )
}
```

The providers file is the one above: it makes the cache with the nonce (`createCache({ key: 'umber', nonce })`) and gives it to `StyleRegistry`, whose element then carries the nonce of the cache. In the browser the same prop gives the browser's cache its nonce, so the rules it writes after hydration are let in too. A registry written by hand does the same with two changes to the one above: the cache gets the nonce, and its element carries `nonce={cache.nonce}`; the suite ran it that way under the policy until `StyleRegistry` took its place in the fixture, and now runs the registry written by hand with no policy only (`/registry`).

One more thing may be needed, and it is not in the providers file: the style that the components are made with. `createStyle` made at the top of a module has a cache of its own. In the browser that cache makes its style element when it writes its first rule, not when the style is made: a style whose components all render under the `CacheProvider` writes nothing into its own cache, adds no element, and needs no nonce (run in the fixture with the theme classes below made over a cache in memory in the browser: every scenario of the policy passed, with no violation). The fixture's style does write rules of its own: the theme classes of `themeClass`, at start-up. Its element is made then, and under the policy it needs the page's nonce too. When it has none, the browser refuses it, and the cache of the registry, which finds that element of its key and writes into it with `insertRule`, keeps the nonce the element has: with the style made without the nonce, the browser reported a `style-src-elem` violation, the one `data-style="umber"` element of the page had no sheet, the button had no padding, and four of the seven scenarios failed. So a style that writes rules of its own in the browser needs the page's nonce, and the engine gives it: a cache with no nonce of its own takes, for the elements it makes, the nonce of the page, the `.nonce` of a style element the policy let in, else that of the first script that carries one (the framework puts the policy's nonce on its scripts), read once, when it makes its first element ([Content security policy](server-rendering.md#content-security-policy)). The fixture's style is given none (`fixtures/shared/src/style.ts`):

```ts
export const style = createStyle(lightTheme, { prefix: 'umber' })
```

The nonce is in no rule, class name or stamp, so the server and the browser still make the same classes, and a page with no policy (nothing carries a nonce) is the same as before. A nonce given to the style (`createStyle(theme, { nonce })`) wins over the page's.

What the suite checks, on the production build and on the development server:

- A page rendered at once, a page that streams through `Suspense`, a client-side navigation to a page with classes of its own, and a theme switch in the browser (the root theme written by the browser's cache after hydration) each have the computed styles of the same page sent with no policy (`?control=no-policy`).
- Every style element of the document carries the response's nonce, in the HTML as sent (the late chunk's element too) and after hydration, the navigation and the switch. The element that holds the dark root theme after the switch carries it: in production the browser's cache writes it with `insertRule` into its element, on the development server as the text of an element of its own.
- No `securitypolicyviolation` event and no console error or warning: no violation and no hydration warning.
- A second request gets another nonce.
- The negative control: with the nonce left off the cache (`?control=no-cache-nonce`) the browser reports `style-src` violations and the page is not styled (the button has no padding).

React hoisted no `<style href precedence>` element on these pages: under a `CacheProvider` the client build renders none, and the components are client components. The framework's scripts carry the nonce, which it read from the policy header of the request.

The parts of the pages are client components. A server component cannot see `CacheProvider` (the server components build has no context), so under a registry written by hand a styled component rendered by a server component sends its own `<style href precedence>` element, outside the registry. Under `StyleRegistry`, in a request with a nonce, the server components hand their styles to it (through `NonceStyles`, a client component, which reads its context); in a request with none React hoists their elements. A server component that calls `useTheme()` of a default style that nothing configured gets `{}` and warns once in development (the theme of the providers file is given to a provider of a client file, never to `configure`): the fixture's `/registry/server-theme` renders `{}`.

The cache key may be the prefix of the style or another one. Under the provider, classes and variables take the key (`other-box-root-<hash>`, `var(--other-palette-primary)`), the root rule declares `--other-...` variables, and the options of a configured style that describe how styles are written still apply; outside the provider the style's prefix is used, so one subtree never has two sets of variables (`packages/server/src/cacheKey.test.tsx`). A default style that was never configured, under a cache of another key, warns once in development: see [A library that wraps the engine](react.md#a-library-that-wraps-the-engine).

The unit test of the same registry, with a stand-in for `useServerInsertedHTML`, is `packages/server/src/registry.test.tsx`. The styling of the app is made once, with its defaults, and knows nothing of the registry:

```tsx
import { createStyle } from '@umber-style/react'

const theme = { palette: { primary: '#1b5fd1', accent: '#d11b5f' }, space: [0, 4, 8] }

const { styled, ThemeProvider, keyframes, Global } = createStyle(theme)
const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
const Hero = styled('section', { name: 'Hero' })(({ theme: view }) => ({
  color: view.palette.primary,
  padding: view.space[2],
  animation: `${fade} 1s`,
}))
function Page() {
  return (
    <ThemeProvider theme={theme}>
      <Global styles={{ body: { margin: 0 } }} />
      <Hero>Hello</Hero>
    </ThemeProvider>
  )
}
```

The `CacheProvider` of the registry turns the automatic style elements off below it, so the registry is the only output: the test checks that the markup has no `<style>` and no `<meta>`, and that each rule of the inserted element appears exactly once in the markup and the inserted HTML together.

On the server the page is `<section class="soroush-hero-root-76d9i0">Hello</section>`, and the registry inserts one element:

```text
<style data-umber="soroush soroush-layers soroush-global-1xngop0 @keyframes:keyframes-1acbpvw soroush-hero-root-76d9i0 soroush-root-49xedb-1ql2sy9">@layer soroush-theme,soroush-global,soroush-components,soroush-overrides;@layer soroush-global{body{margin:0;}}@keyframes keyframes-1acbpvw{0%{opacity:0;}100%{opacity:1;}}@layer soroush-components{.soroush-hero-root-76d9i0{color:var(--soroush-palette-primary);padding:var(--soroush-space-2);animation:keyframes-1acbpvw 1s;}}@layer soroush-theme{:where(:root){--soroush-palette-primary:#1b5fd1;--soroush-space-2:8px;}}</style>
```

`data-umber` is the key, then the names of the groups in the element. The outermost provider declares its theme on `:root` (see [The root theme and switching](root-theme.md)), with the variables the rules use: `--soroush-palette-accent` is not there.

## A static or server page: `createInstance`

For a page that is rendered to a string, `@umber-style/server/create-instance` decides the CSS of the page from the class names in its HTML. From `createInstance.test.ts`:

```ts
import createCache from '@umber-style/cache'
import { createEngine } from '@umber-style/core'
import createInstance from '@umber-style/server/create-instance'

const theme = { palette: { primary: '#0000ff', accent: '#ff0000' }, space: [0, 4, 8] }

const cache = createCache({ key: 'app' })
const engine = createEngine(theme, { cache })
const themeClass = engine.themeClass(theme, 'light')
const fade = engine.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
const box = engine.css({ color: engine.refs.palette.primary, animation: `${fade} 1s` })
const unused = engine.css({ color: engine.refs.palette.accent })
engine.insertGlobal({ body: { margin: 0 } })
const html = `<div class="${themeClass}"><p class="${box}">x</p></div>`

const { extractCriticalToChunks, constructStyleTagsFromChunks } = createInstance(cache)
const chunks = extractCriticalToChunks(html)
const styleTags = constructStyleTagsFromChunks(chunks)
```

`chunks.styles` is two chunks, in this order:

```json
[
  {
    "key": "app-global",
    "css": "@layer app-theme,app-global,app-components,app-overrides;@keyframes keyframes-1acbpvw{0%{opacity:0;}100%{opacity:1;}}@layer app-theme{.app-theme-1u39y9v{--app-palette-primary:#0000ff;color-scheme:light;}}@layer app-global{body{margin:0;}}",
    "ids": ["app-theme-1u39y9v", "app-global-83groy"]
  },
  {
    "key": "app",
    "css": "@layer app-components{.app-5jg77{color:var(--app-palette-primary);animation:keyframes-1acbpvw 1s;}}",
    "ids": ["app-5jg77"]
  }
]
```

and `styleTags` is one element for each chunk that has CSS:

```text
<style data-umber="app-global app-theme-1u39y9v app-global-83groy">@layer app-theme,app-global,app-components,app-overrides;@keyframes keyframes-1acbpvw{0%{opacity:0;}100%{opacity:1;}}@layer app-theme{.app-theme-1u39y9v{--app-palette-primary:#0000ff;color-scheme:light;}}@layer app-global{body{margin:0;}}</style><style data-umber="app app-5jg77">@layer app-components{.app-5jg77{color:var(--app-palette-primary);animation:keyframes-1acbpvw 1s;}}</style>
```

The class `unused` and the variable `--app-palette-accent` are in neither: no element of the page has that class.

| Function                               | Returns                                                                                                                                                                                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extractCriticalToChunks(html)`        | `{ html, styles }`: the chunk `<key>-global` (the layer order, the `@property` and `@keyframes` rules, the theme classes and the global rules; its ids are the theme classes and the global ids), then `<key>` (the rules of the classes of the page) |
| `constructStyleTagsFromChunks(chunks)` | One `<style data-umber="<chunk key> <ids>">` for each chunk that has CSS, in order, as text, with ` nonce="..."` (escaped) when the cache has a nonce. A page with no class of the engine gets the global element only                                |
| `extractCritical(html)`                | `{ html, css, ids }`: the chunks joined, in the same order                                                                                                                                                                                            |
| `renderStylesToString(html)`           | `html` with the elements of its chunks right after its `<head>` when it has one, else at its start                                                                                                                                                    |

```ts
const page = `<!DOCTYPE html><html><head lang="en"><title>t</title></head><body>${html}</body></html>`
renderStylesToString(page)
// <!DOCTYPE html><html><head lang="en"><style data-umber="app-global ...">...</style><style data-umber="app app-5jg77">...</style><title>t</title></head>...
```

The CSS is decided as `extractPageStyles` decides it (`createInstance` is a thin layer over `extractPageStyleParts` of `@umber-style/core`): the global rules of the page (each set that `engine.insertGlobal` wrote for the app, as in the example, and each set of a `Global` that the HTML carries or names in its marker), the `@keyframes` rules the page uses, the theme classes with the variables in use. A set of a `Global` that another page rendered is not in the chunks of this one, whichever page was rendered first (`pageGlobal.test.tsx`). See "What the scan reads" in [Server rendering](server-rendering.md). The cache is not changed, so one cache can serve pages rendered at once, and the same page gets the same CSS.

With the React binding, render the page under `<CacheProvider value={cache}>` (no `<style href precedence>` element is rendered under it), with `renderToStaticMarkup` or `renderToString`, and pass the markup to these functions. A class of `@umber-style/css` made over the same cache is in the same style element and is extracted with the rest, in the cache's layers: a cache of `createCache({ key })` is given to the `createInstance` of `@umber-style/css/create-instance` as it is (`{ cache }`, no `sheet`, no cast), and a cache of the core with the sheet it writes to (`{ cache, sheet }`) (`packages/server/src/sharedCache.test.tsx`). The packed-tarball test does that with the built packages (`scripts/smoke-packed.mjs`, see [Releasing](releasing.md)). The Vike fixture renders its page `/chunks` this way at build time, with a cache made for the page in its `+onRenderHtml` and another made in the browser in its `+onRenderClient` (`fixtures/vike-ssg/src/pages/chunks`): the end-to-end suite finds the page styled with no script, the two chunks in the head, no rule for a class that the page does not have, and a hydration with no warning that writes no rule of the page again (`e2e/tests/chunks.spec.ts`).

### A nonce for each request

A cache made for one request can hold the nonce of that request, and every tag of its instance carries it, escaped. From `packages/server/src/createInstance.test.ts`:

```ts
const cache = createCache({ key: 'app', nonce: 'req"1' })
const engine = createEngine(theme, { cache })
const box = engine.css({ color: engine.refs.palette.primary })
engine.insertGlobal({ body: { margin: 0 } })
const { extractCriticalToChunks, constructStyleTagsFromChunks } = createInstance(cache)
constructStyleTagsFromChunks(extractCriticalToChunks(`<p class="${box}">x</p>`))
// <style data-umber="app-global ..." nonce="req&quot;1">...</style><style data-umber="app app-..." nonce="req&quot;1">...</style>
```

The CSS of the chunks is the same with a nonce or without. A registry of your own writes its `<style data-umber>` elements itself: give them `nonce={cache.nonce}`, and give React's render the same nonce as its style nonce (see [Content security policy](server-rendering.md#content-security-policy)).

A strict nonce policy on a page rendered on a server needs React 19.2 or later: before 19.2 React writes no nonce on the style elements it hoists, and the browser refuses them. That touches the `<style href precedence>` elements of a styled component that renders outside a `CacheProvider`, not the tags of `createInstance`, which are text that carries `cache.nonce`. On 19.0.9 and 19.1.10 React's render sent the merged element with no `nonce` and logged nothing (see [Content security policy](server-rendering.md#content-security-policy)). The registry of the App Router runs the React that Next.js bundles, whatever version the app installs.

## In the browser

A cache made where there is a `document` reads the page at once (the document of its sheet: see "Another document" above): the style elements of its key, `data-umber="<key> ..."` and `data-umber="<key>-global ..."`, as well as the engine's own (`data-style`, `data-precedence`). It learns their rules as it learns those of any server page, and writes none of them again: classes, global rules, `@keyframes` rules, theme variables. The names in each `data-umber` go into `inserted` as `true`. An element that arrives later as a child of `<head>` or `<body>` (a registry streams them into the body after the cache started) is read when it arrives, and its rules are not written again (`packages/core/src/cache.document.test.ts`); its names are not added to `inserted`, which holds the elements of start-up.

On the page that the registry above wrote, `createCache({ key: 'soroush' })` in the browser gives:

```ts
cache.sheet.tags.map((tag) => tag.getAttribute('data-umber'))
// ['soroush soroush-layers soroush-global-1xngop0 @keyframes:keyframes-1acbpvw soroush-hero-root-76d9i0 soroush-root-49xedb-1ql2sy9', null]
cache.inserted
// { 'soroush-layers': true, 'soroush-global-1xngop0': true, '@keyframes:keyframes-1acbpvw': true, 'soroush-hero-root-76d9i0': true, 'soroush-root-49xedb-1ql2sy9': true }
```

The second element is the cache's own (`data-style="soroush"`). Rendering the same page over that cache gives the same markup and calls `insert` for nothing (`registry.test.tsx`); the same holds for a page written with `constructStyleTagsFromChunks`, whose two elements come first in `sheet.tags` (`hydration.test.ts`), and for a cache over that page in `index.test.ts`, whose own style element stays empty.

## Limits

- `CacheProvider` was checked in jsdom with React and Vue, in headless Chromium for the iframe, and in two fixture apps: the registry above in the App Router fixture (Next.js 16.4.6 with Turbopack, production build and development server; no other version was run), and `createInstance` on the prerendered page `/chunks` of the Vike fixture. Vue was not run with either package in a fixture.
- The root rules of a style element are removed by their place in the element's sheet, which the cache knows only when the browser kept every rule of the text. Where it dropped one (a rule it does not know), the root rules of that element stay, whether the element was there at the start or arrived later (`cache.root.test.ts`).
- The root theme is written anew each time a rule uses a variable it had not declared, and a registry that sends every new group sends each of those rules whole: the first flush of the fixture's stream page holds six `:where(:root)` rules, each one the last with more variables. Only the last one is needed.
- A page that renders a styled component from a server component as well as from a client component, under a registry written by hand or under `StyleRegistry` in a request with no nonce, was not run: the same class would then come both from the registry and from a `<style href precedence>` element. Under `StyleRegistry` in a request with a nonce both go to the registry, which writes the text of an `href` once.
- `StyleRegistry` runs on Next.js 16.4.6 (Turbopack, production build and development server), in Chromium only. Partial prerendering and the edge runtime were not tested. It needs `useServerInsertedHTML`: elsewhere nothing writes what it collects.
- The elements of `StyleRegistry` for the later pieces of a stream stay at the top of the body after hydration; they are not moved into the head.
- A cache key other than the style's prefix was run at the unit tier only (`cacheKey.test.tsx`); the fixture's key is the prefix of its style.
- `apply`, `themeClass`, `when` and `whenScheme` are plain functions, not hooks, so they cannot see a `CacheProvider`. `apply` writes an entry into the cache that made it: read the sheet with `useStyle` under the provider. `themeClass` and `when` name theme classes of the engine of their style. A class name string of another cache (`className="..."`) passes through as it is, and its rule is not written into the provider's cache.
- A styled component used as a selector (`${Button}:hover &`) stands for the class of the engine of its style, read when the template is read; under a provider of another prefix that class is not in the provider's cache. Give the component a `target` for that.
- A subtree under a `CacheProvider` with no `ThemeProvider` of its own has no rule that declares the variables of the cache's prefix: put one in it.
- `ThemeScope` and `useThemeClass` under a `CacheProvider` with no `ThemeProvider` of its own repeat the wrapper of the nearest provider outside, whose classes are in the other cache.
- In Vue `value` is read once, in `setup` (see [Vue](vue.md)). In React another `value` is used at the next render.
- Two engines over one cache (a style made with `createStyle(theme, { cache })`, and the engine of another style for the same cache under a provider) both give the cache the theme for keyframes written as a function of the theme, and the last one wins, as with any two engines over one cache.
- A style element is read when the cache is made, and later when it is added as a child of the `<head>` or the `<body>` of the cache's document (the cache watches the children of both, and the root element until there is a body). One added deeper, inside another element, is not read. The body was checked in jsdom, and in Chromium with the stream of the App Router fixture.
- `registered[className]` is `true`, not the style text. The style object is `registered.get(className)`.
- The global rules of a `Global` reach the chunks of a page through the marker in its HTML. HTML that leaves out the markup of a `Global` (a part extracted apart from the rest) leaves its rules out too. A registry does not read markers: it sends each rule once in the request that writes it.
- The registry with a nonce runs in the App Router fixture under a strict policy, in Chromium only, on Next.js 16.4.6. On the development server the framework's own development tools write style elements with no nonce (in the head and in the shadow root of `<nextjs-portal>`), which the policy refuses: the suite tells their violations apart by their script (`next-devtools`) and checks the engine's elements and the page's styles. A strict policy on the development server therefore reports violations that are the framework's. The nonce of the tags of `createInstance` is tested at the unit tier only.
- A strict nonce policy on a page rendered on a server needs React 19.2 or later for the style elements React hoists (above). The HTML React writes on 19.0.9 and 19.1.10 was observed, in Node; a browser refusing it was not watched: it follows from the policy. The App Router fixture runs the React of Next.js 16.4.6, so its policy tests say nothing about the React an app installs.
- A style that the components are made with, and that writes rules into its own cache in the browser (`themeClass` at the top of a module), needs the page's nonce there (above): its element is made at its first rule, with the page's nonce when nothing gives one and the page has one by then (read once, then), and the browser's cache of a registry writes with `insertRule` into the element of its key that it finds, which keeps the nonce it was made with. A style whose element is refused under a strict policy loses its rules and those of the registry; with the development checks its cache warns once, that no nonce was found on the page, that the nonce given to it is not the page's, or that the nonce it took is a script's (a page may give its scripts and its styles different nonces; give the style nonce with `createCache({ nonce })`; the messages are in the content security policy section of `server-rendering.md`). A style that writes none into its own cache makes no element. A cache that has a nonce does not yet refuse an element of its key that has another one.
- A policy that allows styles by hash (`style-src 'sha256-...'`) cannot allow a style made at run time, whose text is not known when the page is sent: under a strict policy the classes the browser makes need a nonce (or `'unsafe-inline'`).
- A cache that stores the HTML of a page apart from its policy header (a CDN, a service worker) serves an old nonce under a new policy, and every element with that nonce is refused, scripts included. Cache the HTML and its policy header together, or inject a fresh nonce on every response.
- There is no `container` option of the cache: give it `createDomSheet(key, container, { nonce })` as its sheet. The `nonce` of the cache is not read when a `sheet` is given.
- With pruning (the default), the rule of a theme class or of the root theme grows as rules use more of its variables. Each addition is reported to `insert` again, under a new name (`app-theme-1u39y9v-beaiho` above). Code that collects names must take each one as a new group, as the registry does.
