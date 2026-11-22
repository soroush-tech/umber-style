import { createCache, createMemorySheet, type Sheet } from './cache'
import { createEngine } from './createEngine'
import { extractPageStyleParts, extractPageStyles } from './extractStyles'

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

/** A sheet that appends only: what a browser sheet does. */
function createAppendSheet(): Sheet {
  const rules: string[] = []
  return { rules, insert: (rule) => void rules.push(rule) }
}

const theme = { palette: { primary: '#0000ff', accent: '#ff0000' }, space: [0, 4, 8] }

function setup(sheet: Sheet = createMemorySheet()) {
  const reported: [name: string, css: string][] = []
  const cache = createCache({
    prefix: 'u',
    sheet,
    onInsert: (name, css) => void reported.push([name, css]),
  })
  const engine = createEngine(theme, { cache })
  return { cache, engine, sheet, reported }
}

describe('onInsert', () => {
  it('reports each group of rules an append-only sheet gets, by name, in the order written', () => {
    const { engine, sheet, reported } = setup(createAppendSheet())
    const themeId = engine.themeClass(theme, 'light').split(' ')[0]
    const fade = engine.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
    const one = engine.css({ color: theme.palette.primary, animation: `${fade} 1s` })
    engine.insertGlobal({ body: { margin: 0 } })
    const two = engine.css({ color: engine.refs.palette.accent })
    expect(reported.map(([name]) => name)).toEqual([
      'u-layers',
      themeId,
      `@keyframes:${fade}`,
      one,
      expect.stringMatching(/^u-global-\w+$/),
      two,
      expect.stringMatching(new RegExp(`^${themeId}-\\w+$`)),
    ])
    expect(reported.map(([, css]) => css).join('')).toBe(sheet.rules.join(''))
    expect(reported[0][1]).toBe('@layer u-theme,u-global,u-components,u-overrides;')
    expect(reported.at(-1)?.[1]).toBe(`@layer u-theme{.${themeId}{--u-palette-accent:#ff0000;}}`)
  })

  it('reports what is added to a theme class as a rule of its own when the sheet replaces the rule', () => {
    const { engine, sheet, reported } = setup()
    const themeId = engine.themeClass(theme).split(' ')[0]
    engine.css({ color: engine.refs.palette.primary })
    engine.css({ color: engine.refs.palette.accent })
    const themes = reported.filter(([name]) => name.startsWith(themeId))
    expect(themes.map(([, css]) => css)).toEqual([
      `@layer u-theme{.${themeId}{--u-palette-primary:#0000ff;}}`,
      `@layer u-theme{.${themeId}{--u-palette-accent:#ff0000;}}`,
    ])
    expect(sheet.rules).toContain(
      `@layer u-theme{.${themeId}{--u-palette-primary:#0000ff;--u-palette-accent:#ff0000;}}`
    )
  })

  it('reports a @property rule under its id, and nothing for rules the page has', () => {
    const rule = '@property --u-a{syntax:"<color>";inherits:true;initial-value:#fff;}'
    const element = document.createElement('style')
    element.setAttribute('data-umber', 'u u-one')
    element.textContent = '@layer u-theme,u-global,u-components,u-overrides;.u-one{color:red;}'
    document.head.appendChild(element)
    const { cache, reported } = setup()
    expect(cache.insertOnce('u-one', ['.u-one{color:red;}'], 'components')).toBe(false)
    cache.registerProperties({ '--u-a': rule })
    cache.css({ color: 'var(--u-a)' })
    expect(reported[1]).toEqual([expect.stringMatching(/^@property:--u-a:\w+$/), rule])
    expect(reported.map(([name]) => name)).not.toContain('u-layers')
  })

  it('takes over the global rules of an element of the global key, and reports none', () => {
    const made = setup()
    made.engine.insertGlobal({ body: { margin: 0 } })
    const css = made.reported.map(([, text]) => text).join('')
    const element = document.createElement('style')
    element.setAttribute('data-umber', `u-global ${made.reported[1][0]}`)
    element.textContent = css
    document.head.appendChild(element)
    const { engine, reported } = setup()
    engine.insertGlobal({ body: { margin: 0 } })
    expect(reported).toEqual([])
  })
})

describe('extractPageParts', () => {
  it('splits the CSS of a page into what no class stands for and the rules of the classes', () => {
    const { engine, cache } = setup()
    const themeClass = engine.themeClass(theme)
    const fade = engine.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
    const one = engine.css({ color: engine.refs.palette.primary, animation: `${fade} 1s` })
    engine.insertGlobal({ body: { margin: 0 } })
    const html = `<div class="${themeClass}"><p class="${one}"></p></div>`
    const { global, classes } = extractPageStyleParts(cache, html)
    const whole = extractPageStyles(cache, html)
    expect(global.css + classes.css).toBe(whole.css)
    expect([...global.ids, ...classes.ids]).toEqual(whole.ids)
    expect(global.ids).toEqual([themeClass.split(' ')[0], expect.stringMatching(/^u-global-/)])
    expect(global.css).toContain(`@keyframes ${fade}`)
    expect(classes).toEqual({ css: cache.getRules(one).join(''), ids: [one] })
    expect(cache.extractPageParts([one]).classes.ids).toEqual([one])
  })
})

describe('onInsert and the root theme', () => {
  it('reports the root rule each time it is rewritten, under a name of its own', () => {
    const { engine, reported } = setup()
    engine.declareRoot(theme)
    engine.css({ color: engine.refs.palette.primary })
    engine.css({ color: engine.refs.palette.accent })
    const roots = reported.filter(([, css]) => css.includes(':where(:root)'))

    expect(roots).toHaveLength(2)
    expect(new Set(roots.map(([name]) => name)).size).toBe(2)
    expect(roots[0][1]).toContain('--u-palette-primary:#0000ff')
    expect(roots[1][1]).toContain('--u-palette-accent:#ff0000')
  })
})
