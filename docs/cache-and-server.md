# The cache and server packages

After this page you can make a cache with `@umber-style/cache` and know each of its members, collect the rules of a request in a registry for the Next.js App Router, render a static or server page with `@umber-style/server/create-instance`, and say what a browser cache does with the style elements they write.

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

The types are exported: `UmberCache` (the cache), `UmberCacheOptions`, `SerializedRule` (`{ name, styles }`) and `UmberSheet`.

The options are those of the core's `createCache` (see [Options reference](options.md)), with `key` for `prefix` and without `onInsert`, which the package uses itself. A key is lowercase letters, digits and hyphens, starting with a letter; another throws:

```text
Error: Invalid cache prefix "Bad Key": use lowercase letters, digits and hyphens.
```

Give the cache to an engine with `createEngine(theme, { cache })`, or to a binding with `createStyle(theme, { cache, hasServerStyleElements: false })` (see the Limits for why the option).

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

## A registry for the Next.js App Router

In the App Router a client component collects the rules that a request writes and sends them with `useServerInsertedHTML`, which the framework calls as the stream goes. This is the registry of `packages/server/src/registry.test.tsx`, with the imports an app has instead of the test's stand-ins:

```tsx
'use client'

import createCache, { type UmberCache } from '@umber-style/cache'
import { useServerInsertedHTML } from 'next/navigation'
import { createContext, useState, type ReactNode } from 'react'

export const CacheContext = createContext<UmberCache | undefined>(undefined)
function CacheProvider({ value, children }: { value: UmberCache; children: ReactNode }) {
  return <CacheContext.Provider value={value}>{children}</CacheContext.Provider>
}

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

The React binding has no cache provider yet, so the test gives the cache to the tree through a context of its own, and makes the styling once for each cache, with the automatic style elements turned off:

```tsx
import { createStyle } from '@umber-style/react'
import { useContext } from 'react'

const theme = { palette: { primary: '#1b5fd1', accent: '#d11b5f' }, space: [0, 4, 8] }

const styles = new WeakMap<UmberCache, ReturnType<typeof createPage>>()
function createPage(cache: UmberCache) {
  const { styled, ThemeProvider, keyframes, Global } = createStyle(theme, {
    cache,
    hasServerStyleElements: false,
  })
  const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
  const Hero = styled('section', { name: 'Hero' })(({ theme: view }) => ({
    color: view.palette.primary,
    padding: view.space[2],
    animation: `${fade} 1s`,
  }))
  return function Page() {
    return (
      <ThemeProvider theme={theme}>
        <Global styles={{ body: { margin: 0 } }} />
        <Hero>Hello</Hero>
      </ThemeProvider>
    )
  }
}
function Page() {
  const cache = useContext(CacheContext) as UmberCache
  const Made = styles.get(cache) ?? createPage(cache)
  styles.set(cache, Made)
  return <Made />
}
```

On the server the page is `<section class="soroush-hero-root-76d9i0">Hello</section>`, and the registry inserts one element (shown with line breaks):

```html
<style
  data-umber="soroush soroush-layers soroush-global-1xngop0 @keyframes:keyframes-1acbpvw soroush-hero-root-76d9i0 soroush-root-49xedb-1ql2sy9"
>
  @layer soroush-theme, soroush-global, soroush-components, soroush-overrides;
  @layer soroush-global {
    body {
      margin: 0;
    }
  }
  @keyframes keyframes-1acbpvw {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
  @layer soroush-components {
    .soroush-hero-root-76d9i0 {
      color: var(--soroush-palette-primary);
      padding: var(--soroush-space-2);
      animation: keyframes-1acbpvw 1s;
    }
  }
  @layer soroush-theme {
    :where(:root) {
      --soroush-palette-primary: #1b5fd1;
      --soroush-space-2: 8px;
    }
  }
</style>
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

and `styleTags` is one element for each chunk that has CSS (shown with line breaks):

```html
<style data-umber="app-global app-theme-1u39y9v app-global-83groy">
  @layer app-theme, app-global, app-components, app-overrides;
  @keyframes keyframes-1acbpvw {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
  @layer app-theme {
    .app-theme-1u39y9v {
      --app-palette-primary: #0000ff;
      color-scheme: light;
    }
  }
  @layer app-global {
    body {
      margin: 0;
    }
  }
</style>
<style data-umber="app app-5jg77">
  @layer app-components {
    .app-5jg77 {
      color: var(--app-palette-primary);
      animation: keyframes-1acbpvw 1s;
    }
  }
</style>
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

The CSS is decided as `extractPageStyles` decides it (`createInstance` is a thin layer over `extractPageStyleParts` of `@umber-style/core`): every global rule the cache holds, the `@keyframes` rules the page uses, the theme classes with the variables in use. See "What the scan reads" in [Server rendering](server-rendering.md). The cache is not changed, so one cache can serve pages rendered at once, and the same page gets the same CSS.

With the React binding, give the cache to `createStyle(theme, { cache, hasServerStyleElements: false })`, render with `renderToStaticMarkup` or `renderToString`, and pass the markup to these functions. The packed-tarball test does that with the built packages (`scripts/smoke-packed.mjs`, see [Releasing](releasing.md)).

## In the browser

A cache made where there is a `document` reads the page at once: the style elements of its key, `data-umber="<key> ..."` and `data-umber="<key>-global ..."`, as well as the engine's own (`data-style`, `data-precedence`). It learns their rules as it learns those of any server page, and writes none of them again: classes, global rules, `@keyframes` rules, theme variables. The names in each `data-umber` go into `inserted` as `true`.

On the page that the registry above wrote, `createCache({ key: 'soroush' })` in the browser gives:

```ts
cache.sheet.tags.map((tag) => tag.getAttribute('data-umber'))
// ['soroush soroush-layers soroush-global-1xngop0 @keyframes:keyframes-1acbpvw soroush-hero-root-76d9i0 soroush-root-49xedb-1ql2sy9', null]
cache.inserted
// { 'soroush-layers': true, 'soroush-global-1xngop0': true, '@keyframes:keyframes-1acbpvw': true, 'soroush-hero-root-76d9i0': true, 'soroush-root-49xedb-1ql2sy9': true }
```

The second element is the cache's own (`data-style="soroush"`). Rendering the same page over that cache gives the same markup and calls `insert` for nothing (`registry.test.tsx`); the same holds for a page written with `constructStyleTagsFromChunks`, whose two elements come first in `sheet.tags` (`hydration.test.ts`), and for a cache over that page in `index.test.ts`, whose own style element stays empty.

## Limits

- Next to a registry, the automatic style elements of the client build would send every rule a second time, as `<style href precedence>` elements: `hasServerStyleElements` is on by default wherever there is no `document`. Turn it off where the styling is made, `createStyle(theme, { cache, hasServerStyleElements: false })`, as the registry test does. No cache provider of the React binding turns it off for the tree below it yet.
- The React binding has no cache provider, so the styling is made once for each cache, as above. The registry ran in a unit test, with stand-ins for `useServerInsertedHTML` and for the cache provider, in jsdom with the `document` removed for the server render. No fixture app uses either package: neither was run in a real Next.js app nor in a real browser.
- A style element is read when the cache is made, and later only when it is added to `<head>` (the cache watches the children of `<head>`). A `data-umber` element streamed into the body after the cache started is not read, and its names are not in `inserted`.
- `registered[className]` is `true`, not the style text. The style object is `registered.get(className)`.
- There is no `container` option (the cache writes to its own style element in `<head>`) and no `nonce` option (see [No inline styles](no-inline-styles.md)).
- With pruning (the default), the rule of a theme class or of the root theme grows as rules use more of its variables. Each addition is reported to `insert` again, under a new name (`app-theme-1u39y9v-beaiho` above). Code that collects names must take each one as a new group, as the registry does.
