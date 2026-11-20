import createCache from '@umber-style/cache'
import { CacheProvider, createStyle } from '@umber-style/react'
import { useState, type ReactNode } from 'react'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'

const theme = { palette: { primary: '#1b5fd1', accent: '#d11b5f' }, space: [0, 4, 8] }

/** A stand-in for the framework's hook: the callbacks it is given are called once the render is done. */
let insertedHtml: (() => ReactNode)[] = []
function useServerInsertedHTML(callback: () => ReactNode): void {
  insertedHtml.push(callback)
}

// The registry of an app, as it is written for the App Router, with only its imports changed.
function UmberRegistry({ children }: { children: ReactNode }) {
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

// The styling of the app, made once, with its defaults: the automatic style elements are on, and a
// CacheProvider turns them off below it, so that the registry is the only output.
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

/** One request: the HTML of the app, and what the registry inserts into the stream. */
function renderRequest() {
  insertedHtml = []
  const html = renderToString(
    <UmberRegistry>
      <Page />
    </UmberRegistry>
  )
  const head = insertedHtml.map((callback) => renderToStaticMarkup(<>{callback()}</>)).join('')
  return { html, head }
}

/** Renders a request where there is no document, as a server does. */
function renderOnServer() {
  vi.stubGlobal('document', undefined)
  try {
    return renderRequest()
  } finally {
    vi.unstubAllGlobals()
  }
}

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('the registry of an app', () => {
  it('writes every rule of the request in data-umber elements, with the layers, theme variables and keyframes', () => {
    const { html, head } = renderOnServer()
    const element = /<style data-umber="soroush ([^"]+)">(.*?)<\/style>/.exec(head)
    expect(element).not.toBeNull()
    const [, names, css] = element as RegExpExecArray
    expect(names.split(' ')).toContain('soroush-layers')
    expect(
      css.startsWith('@layer soroush-theme,soroush-global,soroush-components,soroush-overrides;')
    ).toBe(true)
    expect(css).toContain('--soroush-palette-primary:#1b5fd1;')
    expect(css).toContain('@keyframes ')
    expect(css).toContain('@layer soroush-global{body{margin:0;}}')
    const heroClass = /soroush-hero-root-\w+/.exec(html)?.[0] as string
    expect(names.split(' ')).toContain(heroClass)
    expect(css).toContain(`.${heroClass}{color:var(--soroush-palette-primary);`)
    expect(css).not.toContain('--soroush-palette-accent')
  })

  it('is the only output under the CacheProvider: each rule is sent once in all that the request writes', () => {
    const { html, head } = renderOnServer()
    const output = html + head
    expect(html).not.toContain('<style')
    expect(html).not.toContain('<meta')
    const css = /<style data-umber="[^"]+">(.*?)<\/style>/.exec(head)?.[1] as string
    const rules =
      css.match(/@layer [\w-]+\{.*?\}\}|@keyframes [\w-]+\{.*?\}\}|@layer [^{]+;/g) ?? []
    expect(rules.length).toBeGreaterThan(4)
    for (const rule of rules) expect(output.split(rule)).toHaveLength(2)
  })

  it('flushes each rule once: a second flush of the same request writes nothing', () => {
    const { head } = renderOnServer()
    expect(head).toMatch(/^<style data-umber/)
    expect(insertedHtml.map((callback) => callback())).toEqual([null])
  })

  it('keeps two requests apart: each writes the whole of what it uses', () => {
    const first = renderOnServer()
    const second = renderOnServer()
    expect(second.head).toBe(first.head)
  })

  it('is read by a cache in the browser, which writes none of those rules again', () => {
    const { html, head } = renderOnServer()
    document.head.innerHTML = head
    document.body.innerHTML = html
    const cache = createCache({ key: 'soroush', hasDevChecks: false })
    const written: string[] = []
    const prevInsert = cache.insert
    cache.insert = (...args) => {
      written.push(args[1].name)
      return prevInsert(...args)
    }
    expect(cache.sheet.tags).toHaveLength(2)
    insertedHtml = []
    const again = renderToString(
      <CacheProvider value={cache}>
        <Page />
      </CacheProvider>
    )
    expect(again).toBe(html)
    expect(written).toEqual([])
  })
})
