# The cache and server packages

After this page you can make a cache with `@umber-style/cache` and know each of its members, give a subtree its cache with `CacheProvider` (in another document too, such as an iframe), collect the rules of a request in a registry for the Next.js App Router, render a static or server page with `@umber-style/server/create-instance`, and say what a browser cache does with the style elements they write.

The bindings render on a server without these two packages: see [Server rendering](server-rendering.md). Use them when your set-up collects the rules itself, keyed by a cache: a registry that writes a `<style data-umber>` element as the stream goes, or a server that sends the CSS of a page in chunks.

| Package                               | What it is                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `@umber-style/cache`                  | `createCache({ key })`: the engine's cache, keyed by `key`, with the members a set-up reads and wraps               |
| `@umber-style/server/create-instance` | `createInstance(cache)`: the CSS that one page needs, as chunks, as `<style data-umber>` tags, or put into the HTML |

Both are default exports, and both depend on `@umber-style/core` only.

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

The options are those of the core's `createCache` (see [Options reference](options.md)), with `key` for `prefix` and without `onInsert`, which the package uses itself. `speedy` is kept for compatibility with what an app passes to its cache when it moves from the styling library it used: `speedy: true` is `hasRuleText: false` (rules written with `insertRule`), `speedy: false` is `hasRuleText: true` (rules as text nodes, readable through `textContent`), and `hasRuleText` wins when both are given. Without either, the rules are text outside production and go in with `insertRule` in production. A key is lowercase letters, digits and hyphens, starting with a letter; another throws:

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
| `hasRuleText`, `sheet`, `onInsert`                              | the cache | Where the rules go                                                                                                                                                          |

An engine given a `cache` directly (`createStyle(theme, { cache })`) follows the same table, and with the development checks it warns once, naming each option of the cache column that it was given: the cache decides those, and they are ignored. A class is named from the rules it writes, so the same styles written with value repair and without it are two classes, each with its own rule. The stamp of the options that a server writes is the cache's (`cache.fingerprint`): the style options of an engine over a provided cache are not in it, as its token options are not, because they come from the same module code on the server and in the browser. Labels are the cache's (`hasLabels`, on by default in both): a class has a label when its style has one (the `name` or `label` of `styled`, a `label` key), under a provider or not; a `css()` value or a plain object without a `label` key gives a class without one. The tests are `createEngine.withCache.test.ts` and, with the set-up of an app (`createCache({ key })`, `CacheProvider`, `configure`, `@umber-style/server`), `appSetUp.test.tsx` of the server package.

**The default cache of an app.** The app above never calls `configure`: its class names and variables have the prefix `soroush` everywhere, and the cache of the default engine stays empty (`CacheProvider.test.tsx`, "the default cache of an app").

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

In the App Router a client component collects the rules that a request writes and sends them with `useServerInsertedHTML`, which the framework calls as the stream goes. This is the registry of `packages/server/src/registry.test.tsx`, with the framework's import instead of the test's stand-in:

```tsx
'use client'

import createCache from '@umber-style/cache'
import { CacheProvider } from '@umber-style/react'
import { useServerInsertedHTML } from 'next/navigation'
import { useState, type ReactNode } from 'react'

export function UmberRegistry({ children }: { children: ReactNode }) {
  const [{ cache, flush }] = useState(() => {
    const cache = createCache({ key: 'soroush' })
    cache.compat = true
    const prevInsert = cache.insert
    let inserted: string[] = []
    cache.insert = (...args) => {
      const serialized = args[1]
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name)
      }
      return prevInsert(...args)
    }
    const flush = () => {
      const prevInserted = inserted
      inserted = []
      return prevInserted
    }
    return { cache, flush }
  })

  useServerInsertedHTML(() => {
    const names = flush()
    if (names.length === 0) return null
    let styles = ''
    for (const name of names) {
      styles += cache.inserted[name]
    }
    return (
      <style
        key={cache.key}
        data-umber={`${cache.key} ${names.join(' ')}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    )
  })

  return <CacheProvider value={cache}>{children}</CacheProvider>
}
```

Render `UmberRegistry` around the children of the root layout. Each request makes its own cache (the state of the registry), and each flush writes the names collected since the last one: a rule is sent once, a second flush with nothing new returns `null`, and two requests each send the whole of what they use (the tests of the file check the three).

The styling of the app is made once, with its defaults, and knows nothing of the registry:

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
| `constructStyleTagsFromChunks(chunks)` | One `<style data-umber="<chunk key> <ids>">` for each chunk that has CSS, in order, as text. A page with no class of the engine gets the global element only                                                                                          |
| `extractCritical(html)`                | `{ html, css, ids }`: the chunks joined, in the same order                                                                                                                                                                                            |
| `renderStylesToString(html)`           | `html` with the elements of its chunks right after its `<head>` when it has one, else at its start                                                                                                                                                    |

```ts
const page = `<!DOCTYPE html><html><head lang="en"><title>t</title></head><body>${html}</body></html>`
renderStylesToString(page)
// <!DOCTYPE html><html><head lang="en"><style data-umber="app-global ...">...</style><style data-umber="app app-5jg77">...</style><title>t</title></head>...
```

The CSS is decided as `extractPageStyles` decides it (`createInstance` is a thin layer over `extractPageStyleParts` of `@umber-style/core`): the global rules of the page (each set that `engine.insertGlobal` wrote for the app, as in the example, and each set of a `Global` that the HTML carries or names in its marker), the `@keyframes` rules the page uses, the theme classes with the variables in use. A set of a `Global` that another page rendered is not in the chunks of this one, whichever page was rendered first (`pageGlobal.test.tsx`). See "What the scan reads" in [Server rendering](server-rendering.md). The cache is not changed, so one cache can serve pages rendered at once, and the same page gets the same CSS.

With the React binding, render the page under `<CacheProvider value={cache}>` (no `<style href precedence>` element is rendered under it), with `renderToStaticMarkup` or `renderToString`, and pass the markup to these functions. A class of `@umber-style/css` made over the same cache (`createInstance({ cache, sheet })`) is in the same style element and is extracted with the rest (`packages/server/src/sharedCache.test.tsx`). The packed-tarball test does that with the built packages (`scripts/smoke-packed.mjs`, see [Releasing](releasing.md)).

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

- `CacheProvider` was checked in jsdom with React and Vue, and in headless Chromium for the iframe. The registry ran in a unit test, with a stand-in for `useServerInsertedHTML`, in jsdom with the `document` removed for the server render. No fixture app uses `CacheProvider` or either package: neither was run in a real Next.js app.
- `apply`, `themeClass`, `when` and `whenScheme` are plain functions, not hooks, so they cannot see a `CacheProvider`. `apply` writes an entry into the cache that made it: read the sheet with `useStyle` under the provider. `themeClass` and `when` name theme classes of the engine of their style. A class name string of another cache (`className="..."`) passes through as it is, and its rule is not written into the provider's cache.
- A styled component used as a selector (`${Button}:hover &`) stands for the class of the engine of its style, read when the template is read; under a provider of another prefix that class is not in the provider's cache. Give the component a `target` for that.
- A subtree under a `CacheProvider` with no `ThemeProvider` of its own has no rule that declares the variables of the cache's prefix: put one in it.
- `ThemeScope` and `useThemeClass` under a `CacheProvider` with no `ThemeProvider` of its own repeat the wrapper of the nearest provider outside, whose classes are in the other cache.
- In Vue `value` is read once, in `setup` (see [Vue](vue.md)). In React another `value` is used at the next render.
- Two engines over one cache (a style made with `createStyle(theme, { cache })`, and the engine of another style for the same cache under a provider) both give the cache the theme for keyframes written as a function of the theme, and the last one wins, as with any two engines over one cache.
- A style element is read when the cache is made, and later when it is added as a child of the `<head>` or the `<body>` of the cache's document (the cache watches the children of both, and the root element until there is a body). One added deeper, inside another element, is not read. The body was checked in jsdom, not in a streamed page of a real browser.
- `registered[className]` is `true`, not the style text. The style object is `registered.get(className)`.
- The global rules of a `Global` reach the chunks of a page through the marker in its HTML. HTML that leaves out the markup of a `Global` (a part extracted apart from the rest) leaves its rules out too. A registry does not read markers: it sends each rule once in the request that writes it.
- There is no `container` option of the cache (give it `createDomSheet(key, container)` as its sheet) and no `nonce` option (see [No inline styles](no-inline-styles.md)).
- With pruning (the default), the rule of a theme class or of the root theme grows as rules use more of its variables. Each addition is reported to `insert` again, under a new name (`app-theme-1u39y9v-beaiho` above). Code that collects names must take each one as a new group, as the registry does.
