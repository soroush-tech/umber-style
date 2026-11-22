// @vitest-environment node
import createCache from '@umber-style/cache'
import { createEngine } from '@umber-style/core'
import createInstance from './createInstance'

const theme = { palette: { primary: '#0000ff', accent: '#ff0000' }, space: [0, 4, 8] }

/** A cache and its engine, with a page that uses a theme, a class with an animation, and one class it does not use. */
function setup(key = 'app') {
  const cache = createCache({ key })
  const engine = createEngine(theme, { cache })
  const themeClass = engine.themeClass(theme, 'light')
  const fade = engine.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
  const box = engine.css({ color: engine.refs.palette.primary, animation: `${fade} 1s` })
  const unused = engine.css({ color: engine.refs.palette.accent })
  engine.insertGlobal({ body: { margin: 0 } })
  const html = `<div class="${themeClass}"><p class="${box}">x</p></div>`
  return { cache, engine, themeId: themeClass.split(' ')[0], fade, box, unused, html }
}

describe('createInstance', () => {
  it('extracts the chunks of a page: the global rules apart from the classes, with their ids', () => {
    const { cache, themeId, fade, box, unused, html } = setup()
    const { extractCriticalToChunks } = createInstance(cache)
    const chunks = extractCriticalToChunks(html)
    expect(chunks.html).toBe(html)
    const [global, classes] = chunks.styles
    expect(global.key).toBe('app-global')
    expect(global.ids).toEqual([themeId, expect.stringMatching(/^app-global-\w+$/)])
    expect(global.css).toBe(
      '@layer app-theme,app-global,app-components,app-overrides;' +
        `@keyframes ${fade}{0%{opacity:0;}100%{opacity:1;}}` +
        `@layer app-theme{.${themeId}{--app-palette-primary:#0000ff;color-scheme:light;}}` +
        '@layer app-global{body{margin:0;}}'
    )
    expect(classes).toEqual({
      key: 'app',
      ids: [box],
      css: `@layer app-components{.${box}{color:var(--app-palette-primary);animation:${fade} 1s;}}`,
    })
    expect(JSON.stringify(chunks)).not.toContain(unused)
    expect(JSON.stringify(chunks)).not.toContain('--app-palette-accent')
  })

  it('writes one style element for each chunk that has CSS, keyed by the chunk', () => {
    const { cache, html } = setup()
    const { extractCriticalToChunks, constructStyleTagsFromChunks } = createInstance(cache)
    const [global, classes] = extractCriticalToChunks(html).styles
    expect(constructStyleTagsFromChunks({ styles: [global, classes] })).toBe(
      `<style data-umber="app-global ${global.ids.join(' ')}">${global.css}</style>` +
        `<style data-umber="app ${classes.ids[0]}">${classes.css}</style>`
    )
    // A page with no class of the engine: the global rules, and no element for the classes.
    expect(constructStyleTagsFromChunks(extractCriticalToChunks('<p></p>'))).toBe(
      `<style data-umber="app-global ${global.ids[1]}">` +
        '@layer app-theme,app-global,app-components,app-overrides;@layer app-global{body{margin:0;}}</style>'
    )
  })

  it('writes the nonce of the cache into every style element, escaped, and into no CSS', () => {
    const cache = createCache({ key: 'app', nonce: 'req"1' })
    const engine = createEngine(theme, { cache })
    const box = engine.css({ color: engine.refs.palette.primary })
    engine.insertGlobal({ body: { margin: 0 } })
    const html = `<p class="${box}">x</p>`
    const { extractCriticalToChunks, constructStyleTagsFromChunks, renderStylesToString } =
      createInstance(cache)
    const chunks = extractCriticalToChunks(html)
    const [global, classes] = chunks.styles
    const tags = constructStyleTagsFromChunks(chunks)
    expect(tags).toBe(
      `<style data-umber="app-global ${global.ids.join(' ')}" nonce="req&quot;1">${global.css}</style>` +
        `<style data-umber="app ${box}" nonce="req&quot;1">${classes.css}</style>`
    )
    expect(global.css + classes.css).not.toContain('req')
    expect(renderStylesToString(`<head></head>${html}`)).toBe(`<head>${tags}</head>${html}`)
  })

  it('extracts the critical CSS in one piece: the chunks joined', () => {
    const { cache, html } = setup()
    const { extractCritical, extractCriticalToChunks } = createInstance(cache)
    const { styles } = extractCriticalToChunks(html)
    expect(extractCritical(html)).toEqual({
      html,
      css: styles[0].css + styles[1].css,
      ids: [...styles[0].ids, ...styles[1].ids],
    })
  })

  it('puts the style elements right after the head, or at the start of a fragment', () => {
    const { cache, html } = setup()
    const { renderStylesToString, extractCriticalToChunks, constructStyleTagsFromChunks } =
      createInstance(cache)
    const tags = constructStyleTagsFromChunks(extractCriticalToChunks(html))
    expect(renderStylesToString(html)).toBe(tags + html)
    const page = `<!DOCTYPE html><html><head lang="en"><title>t</title></head><body>${html}</body></html>`
    expect(renderStylesToString(page)).toBe(
      `<!DOCTYPE html><html><head lang="en">${tags}<title>t</title></head><body>${html}</body></html>`
    )
  })

  it('gives the same output for the same page, and keeps two caches apart', () => {
    const first = setup('one')
    const second = setup('two')
    const instance = createInstance(first.cache)
    expect(instance.extractCritical(first.html)).toEqual(instance.extractCritical(first.html))
    const fromFirst = instance.extractCritical(second.html)
    expect(fromFirst.ids).toEqual([expect.stringMatching(/^one-global-/)])
    expect(createInstance(second.cache).extractCritical(second.html).css).toContain(
      `.${second.box}{`
    )
  })
})
