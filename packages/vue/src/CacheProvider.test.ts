import { createApp, createSSRApp, defineComponent, h, nextTick, ref, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createCache, createMemorySheet } from '@umber-style/core'
import { CacheProvider } from './CacheProvider'
import { createStyle } from './createStyle'
import { createDefaultStyle } from './defaultStyle'

const theme = { palette: { primary: '#0000ff' }, space: { small: 4 } }
const dark = { palette: { primary: '#8888ff' } }

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

/** A cache over a sheet in memory, so that a test reads its rules. */
function createSheetCache(prefix: string) {
  const sheet = createMemorySheet()
  const cache = createCache({ prefix, sheet, hasDevChecks: false })
  const css = () => sheet.rules.join('')
  return { sheet, cache, css }
}

/** A style whose engine writes into a cache of its own (`base`), as an app's would. */
function setup() {
  const base = createSheetCache('base')
  const style = createStyle(theme, { cache: base.cache })
  return { ...style, base }
}

function mount(component: Component) {
  const element = document.createElement('div')
  document.body.appendChild(element)
  const app = createApp(component)
  app.mount(element)
  return { element, app }
}

const classOf = (element: Element, id: string) =>
  (element.querySelector(`[data-testid="${id}"]`) as HTMLElement).className

describe('a subtree under a CacheProvider', () => {
  it('writes its classes into the given cache, and a sibling outside keeps the engine cache', () => {
    const { styled, base } = setup()
    const sub = createSheetCache('sub')
    const Fixed = styled('p', { name: 'Fixed' })({ margin: 1 })
    const Themed = styled('p', { name: 'Themed' })(({ theme: view }) => ({
      color: view.palette.primary,
    }))
    const { element } = mount({
      render: () => [
        h(Fixed, { 'data-testid': 'outside' }),
        h(CacheProvider, { value: sub.cache }, () => [
          h(Fixed, { 'data-testid': 'inside' }),
          h(Themed, { 'data-testid': 'themed' }),
        ]),
      ],
    })
    expect(classOf(element, 'outside')).toMatch(/^base-fixed-root-/)
    expect(classOf(element, 'inside')).toMatch(/^sub-fixed-root-/)
    expect(sub.css()).toContain(`.${classOf(element, 'themed')}{color:var(--sub-palette-primary);}`)
    expect(base.css()).not.toContain('sub-')
  })

  it('writes sheet entries and css() values made at module scope into the given cache', () => {
    const { styled, StyleSheet, useStyle, apply, css, base } = setup()
    const sub = createSheetCache('sub')
    const sheet = StyleSheet.create({ box: { padding: 2 }, line: { margin: 5 } })
    const themed = StyleSheet.create((view) => ({ text: { color: view.palette.primary } }))
    const value = css({ margin: 3 })
    const Box = styled('div')({ display: 'block' })
    const Content = defineComponent({
      setup() {
        const entries = useStyle(sheet)
        const text = useStyle(themed)
        return () => [
          h(Box, { 'data-testid': 'entry', style: sheet.box }),
          h(Box, { 'data-testid': 'css', style: value }),
          h(Box, { 'data-testid': 'merged', style: [sheet.line, entries.box, { opacity: 1 }] }),
          h('p', { 'data-testid': 'applied', ...apply(entries.box) }),
          h('p', { 'data-testid': 'themed', ...apply(text.text) }),
        ]
      },
    })
    const { element } = mount({
      render: () => h(CacheProvider, { value: sub.cache }, () => h(Content)),
    })
    for (const id of ['entry', 'css', 'merged', 'applied', 'themed']) {
      for (const name of classOf(element, id).split(' ')) expect(name).toMatch(/^sub-/)
    }
    expect(sub.css()).toContain('{margin:5px;padding:2px;opacity:1;}')
    expect(sub.css()).toContain('{margin:3px;}')
    expect(sub.css()).toContain('{color:var(--sub-palette-primary);}')
    expect(base.sheet.rules).toEqual([])
  })

  it('declares the theme on :root, the theme classes, global rules and keyframes in the given cache', async () => {
    const { styled, ThemeProvider, Global, keyframes, base } = setup()
    const sub = createSheetCache('sub')
    const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
    const Moving = styled('p')({ animation: `${fade} 1s` })
    const isMargin = ref(true)
    const { element } = mount({
      render: () =>
        h(ThemeProvider, { theme }, () =>
          h(CacheProvider, { value: sub.cache }, () =>
            h(ThemeProvider, { theme }, () => [
              h(Global, {
                styles: (view: typeof theme) =>
                  isMargin.value
                    ? { body: { margin: view.space.small } }
                    : { body: { padding: view.space.small } },
              }),
              h(ThemeProvider, { theme: dark }, () => h(Moving)),
            ])
          )
        ),
    })
    expect((element.querySelector('div') as HTMLElement).className).toMatch(
      /^sub-theme-\w+ sub-boundary/
    )
    expect(sub.css()).toContain(':where(:root){--sub-space-small:4px;}')
    expect(sub.css()).toContain('{body{margin:var(--sub-space-small);}}')
    expect(sub.css()).toContain(`@keyframes ${fade}{`)
    isMargin.value = false
    await nextTick()
    expect(sub.css()).toContain('{body{padding:var(--sub-space-small);}}')
    expect(sub.css()).not.toContain('{body{margin:var(--sub-space-small);}}')
    expect(base.sheet.rules.join('')).not.toContain('sub-')
  })

  it('uses the cache of the nearest provider, and releases what it wrote when it unmounts', () => {
    const { styled, Global } = setup()
    const outer = createSheetCache('outer')
    const inner = createSheetCache('inner')
    const Box = styled('p')({ margin: 1 })
    const { element, app } = mount({
      render: () =>
        h(CacheProvider, { value: outer.cache }, () => [
          h(Box, { 'data-testid': 'outer' }),
          h(CacheProvider, { value: inner.cache }, () => [
            h(Box, { 'data-testid': 'inner' }),
            h(Global, { styles: { body: { margin: 0 } } }),
          ]),
        ]),
    })
    expect(classOf(element, 'outer')).toMatch(/^outer-/)
    expect(classOf(element, 'inner')).toMatch(/^inner-/)
    expect(inner.css()).toContain('{body{margin:0;}}')
    app.unmount()
    expect(inner.css()).not.toContain('{body{margin:0;}}')
  })

  it('takes over the style of a provider whose cache is the engine own', () => {
    const own = createSheetCache('own')
    const style = createStyle(theme, { cache: own.cache })
    const Themed = style.styled('p')(({ theme: view }) => ({ color: view.palette.primary }))
    const Probe = defineComponent({
      setup() {
        const entries = style.useStyle(style.StyleSheet.create({ box: { margin: 1 } }))
        return () => h(Themed, { style: entries.box })
      },
    })
    const { element } = mount({
      render: () =>
        h(style.ThemeProvider, { theme }, () =>
          h(CacheProvider, { value: own.cache }, () => h(Probe))
        ),
    })
    expect((element.querySelector('p') as HTMLElement).className).toMatch(/^own-/)
  })
})

describe('the default cache of an app', () => {
  it('is the cache of a provider around the whole tree: every class has its prefix, and the engine cache stays empty', async () => {
    const style = createDefaultStyle()
    const app = createSheetCache('soroush')
    const Box = style.styled('p', { name: 'Box' })(({ theme: view }) => ({
      color: (view as unknown as typeof theme).palette.primary,
    }))
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(CacheProvider, { value: app.cache }, () =>
            h(style.ThemeProvider, { theme: theme as never }, () => h(Box))
          ),
      })
    )
    expect(html).toContain('<p class="soroush-box-root-')
    expect(app.css()).toContain(':where(:root){--soroush-palette-primary:#0000ff;}')
    expect(style.getEngine().cache.extract().css).toBe('')
  })
})
