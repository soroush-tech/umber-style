import { createApp, createSSRApp, h, nextTick, ref, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createCache, createStyleTag, type Sheet } from '@umber-style/core'
import { createStyle } from './createStyle'

const theme = {
  palette: { background: '#ffffff', text: '#111111' },
  breakpoints: { md: 768 },
}

/** A style over an in-memory sheet without layers that logs each rule it inserts and removes, in order. */
function setup() {
  const rules: string[] = []
  const log: string[] = []
  const sheet: Sheet = {
    rules,
    insert(rule) {
      rules.push(rule)
      log.push(`+${rule}`)
    },
    remove(index) {
      log.push(`-${rules[index]}`)
      rules.splice(index, 1)
    },
  }
  const style = createStyle(theme, {
    prefix: 'g',
    cache: createCache({ prefix: 'g', sheet, hasLayers: false }),
  })
  return { ...style, rules, log }
}

/** Mounts `component` into a new element; returns the element and the app, to unmount. */
function mount(component: Component) {
  const element = document.createElement('div')
  const app = createApp(component)
  app.mount(element)
  return { element, app }
}

describe('Global in the browser', () => {
  it('renders nothing, writes its rules when it mounts and removes them when it unmounts', () => {
    const { Global, globalStyles, rules } = setup()
    const base = globalStyles((view) => ({
      'html, body': { margin: 0, color: view.palette.text },
    }))
    const { element, app } = mount(() => h(Global, { styles: base }))
    expect(element.textContent).toBe('')
    expect(rules).toEqual(['html, body{margin:0;color:var(--g-palette-text);}'])
    app.unmount()
    expect(rules).toEqual([])
  })

  it('replaces its rules when the styles change, writing the new ones before it removes the old ones', async () => {
    const { Global, rules, log } = setup()
    const margin = ref(0)
    mount(() => h(Global, { styles: { body: { margin: margin.value } } }))
    margin.value = 8
    await nextTick()
    expect(rules).toEqual(['body{margin:8px;}'])
    expect(log).toEqual(['+body{margin:0;}', '+body{margin:8px;}', '-body{margin:0;}'])
  })

  it('writes nothing again for a theme that changes only tokens, and replaces its rules for raw keys', async () => {
    const { Global, ThemeProvider, globalStyles, rules, log } = setup()
    const media = globalStyles((view) => ({
      body: { color: view.palette.text },
      [`@media (min-width: ${view.breakpoints.md}px)`]: { body: { margin: 0 } },
    }))
    const given = ref<Record<string, unknown>>({ breakpoints: { md: 1024 } })
    mount(() =>
      h(ThemeProvider, { theme: given.value, isRoot: true }, () => h(Global, { styles: media }))
    )
    const written = [
      'body{color:var(--g-palette-text);}',
      '@media (min-width: 1024px){body{margin:0;}}',
    ]
    expect(rules).toEqual(written)
    given.value = { breakpoints: { md: 1024 }, palette: { text: '#eeeeee' } }
    await nextTick()
    expect(log).toEqual(written.map((rule) => `+${rule}`))
    given.value = { breakpoints: { md: 600 } }
    await nextTick()
    expect(rules).toEqual([
      'body{color:var(--g-palette-text);}',
      '@media (min-width: 600px){body{margin:0;}}',
    ])
  })

  it('keeps rules that two components write until both have unmounted', async () => {
    const { Global, globalStyles, rules } = setup()
    const reset = globalStyles({ '*, *::before, *::after': { boxSizing: 'border-box' } })
    const count = ref(2)
    mount(() => [
      count.value > 0 ? h(Global, { styles: reset }) : null,
      count.value > 1
        ? h(Global, { styles: { '*, *::before, *::after': { boxSizing: 'border-box' } } })
        : null,
    ])
    expect(rules).toEqual(['*, *::before, *::after{box-sizing:border-box;}'])
    count.value = 1
    await nextTick()
    expect(rules).toHaveLength(1)
    count.value = 0
    await nextTick()
    expect(rules).toEqual([])
  })

  it('writes a list in its order: handles, objects and functions of the theme', () => {
    const { Global, globalStyles, rules } = setup()
    const reset = globalStyles({ html: { WebkitTextSizeAdjust: '100%' } })
    mount(() =>
      h(Global, {
        styles: [
          reset,
          { body: { margin: 0 } },
          (view: typeof theme) => ({ body: { background: view.palette.background } }),
        ],
      })
    )
    expect(rules).toEqual([
      'html{-webkit-text-size-adjust:100%;}',
      'body{margin:0;}',
      'body{background:var(--g-palette-background);}',
    ])
  })
})

describe('an animated styled component in the browser', () => {
  it('writes the animation once, for every class that uses it, and for a global rule', () => {
    const { styled, keyframes, Global, rules } = setup()
    const pulse = keyframes({ '50%': { opacity: 0.4 } }, { label: 'pulse' })
    const Skeleton = styled('div', { name: 'Skeleton' })({
      animation: `${pulse} 1.5s ease-in-out infinite`,
    })
    const Dot = styled('span', { name: 'Dot' })({ animationName: pulse, animationDuration: 300 })
    mount(() => [h(Skeleton), h(Dot), h(Global, { styles: { body: { animationName: pulse } } })])
    expect(rules.filter((rule) => rule.startsWith('@keyframes'))).toEqual([
      `@keyframes ${pulse}{50%{opacity:0.4;}}`,
    ])
    expect(rules.join('')).toContain(`{animation-name:${pulse};animation-duration:300ms;}`)
  })
})

describe('hydrating a page that a server rendered with Global', () => {
  afterEach(() => {
    document.head.innerHTML = ''
    vi.unstubAllGlobals()
  })

  /** The app, with global styles and an animated component, made over a style of its own. */
  function createPage() {
    const style = createStyle(theme, { prefix: 'hv' })
    const fade = style.keyframes({ from: { opacity: 0 } }, { label: 'fade' })
    const Box = style.styled('div', { name: 'Box' })({ animation: `${fade} 2s` })
    const app = createSSRApp(() => [
      h(style.Global, {
        styles: (view: typeof theme) => ({ body: { margin: 0, color: view.palette.text } }),
      }),
      h(Box, null, () => 'hello'),
    ])
    return { ...style, app, fade }
  }

  it('writes no global or @keyframes rule that the page has, and warns of nothing', async () => {
    vi.stubGlobal('document', undefined)
    const server = createPage()
    const html = await renderToString(server.app)
    const tag = createStyleTag(server.cache)
    vi.unstubAllGlobals()
    expect(tag).toContain('@layer hv-global{body{margin:0;')
    expect(tag).toContain(`@keyframes ${server.fade}`)
    // The server's Global rendered its marker, a comment; the browser's renders an empty one.
    expect(html).toMatch(/^<!--\[--><!--hv-global hv-global-\w+-->/)

    document.head.innerHTML = tag
    const container = document.createElement('div')
    container.innerHTML = html
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const client = createPage()
    const before = client.cache.extract().css
    client.app.mount(container)
    expect(warn).not.toHaveBeenCalled()
    expect(container.textContent).toBe('hello')
    expect(client.cache.extract().css).toBe(before)
    expect(client.cache.extract().ids).toContainEqual(expect.stringMatching(/^hv-global-/))
  })
})
