import { createCache, createMemorySheet, type Cache } from './cache'
import { createEngine, type Engine } from './createEngine'
import { extractPageStyles } from './extractStyles'
import type { EngineOptions } from './types'
import type { WebStyleObject } from './webStyle'

afterEach(() => {
  document.head.innerHTML = ''
})

const light = {
  palette: {
    primary: '#0000ff',
    text: '#000000',
    accent: '#ff0000',
    alias: 'var(--u-palette-text)',
    alias2: 'var(--u-palette-primary)',
  },
  space: [0, 4, 8],
}
const dark = { palette: { primary: '#8888ff', text: '#ffffff', accent: '#ff8888' } }
type Palette = typeof light

function setup(options: EngineOptions = {}) {
  const cache = createCache({ prefix: 'u', sheet: createMemorySheet(), ...options })
  const engine = createEngine<Palette>(light, { prefix: 'u', cache })
  const lightClass = engine.themeClass(light, 'light')
  const darkClass = engine.themeClass(dark, 'dark')
  return { cache, engine, lightClass, darkClass }
}

type Setup = ReturnType<typeof setup>

/** The three pages of the tests: each uses one component of its own, and the button, which also reads a prop. */
function createPages({ engine }: Setup) {
  const { refs } = engine
  const button = engine.createStyler({ name: 'Button' }, [
    { font: 'inherit', '&:hover': { opacity: 0.8 } },
    ({ theme, tone }: { theme: Palette; tone?: string }) => ({
      color: tone === 'accent' ? theme.palette.accent : theme.palette.primary,
      padding: theme.space[2],
    }),
  ])
  const card = engine.createStyler({ name: 'Card' }, [
    { color: refs.palette.text, margin: refs.space[1] },
  ])
  const hero = engine.createStyler({ name: 'Hero' }, [{ color: refs.palette.accent }])
  const render = (name: 'home' | 'catalog' | 'settings') => {
    const root = engine.themeClass(light, 'light')
    const inner = {
      home: () => `<a class="${button.getClassName({}, undefined, refs)}">`,
      catalog: () =>
        `<a class="${card.getClassName({})}"><b class="${button.getClassName({ tone: 'accent' }, undefined, refs)}">`,
      settings: () => `<a class="${hero.getClassName({})}">`,
    }[name]()
    return `<main class="${root}">${inner}</main>`
  }
  return { render }
}

const NAMES = ['home', 'catalog', 'settings'] as const

/** The CSS each page gets when it is the only page the cache has ever rendered. */
function createReference(name: (typeof NAMES)[number]) {
  const made = setup()
  const html = createPages(made).render(name)
  return extractPageStyles(made.cache, html, { themes: [made.lightClass, made.darkClass] }).css
}

const permutations = <T>(items: readonly T[]): T[][] =>
  items.length <= 1
    ? [[...items]]
    : items.flatMap((item, index) =>
        permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [
          item,
          ...rest,
        ])
      )

describe('extractPageStyles', () => {
  it('writes the order statement, the theme classes and the rules of the classes of the page', () => {
    const made = setup()
    const html = createPages(made).render('home')
    const { css, ids, tag, options } = extractPageStyles(made.cache, html)
    expect(css.startsWith('@layer u-theme,u-global,u-components,u-overrides;')).toBe(true)
    expect(css).toContain(`.${made.lightClass.split(' ')[0]}{`)
    expect(css).toContain('color:var(--u-palette-primary);')
    expect(css).toContain(':hover{opacity:0.8;}')
    expect(css).not.toContain('--u-palette-accent:')
    expect(css).not.toContain(made.darkClass.split(' ')[0])
    expect(ids).toHaveLength(3)
    expect(options).toBe(made.cache.fingerprint)
    expect(tag).toBe(`<style data-style="u" data-options="${options}">${css}</style>`)
  })

  it('gives a theme class only the variables that the page uses, and its color-scheme', () => {
    const made = setup()
    const { css } = extractPageStyles(made.cache, createPages(made).render('home'))
    const rule = css.match(/@layer u-theme\{\.u-theme-\w+\{([^}]*)\}\}/)?.[1] ?? ''
    expect(rule).toBe('--u-palette-primary:#0000ff;--u-space-2:8px;color-scheme:light;')
  })

  it('gives the same CSS to each page, whatever order the three were rendered in', () => {
    const reference = Object.fromEntries(NAMES.map((name) => [name, createReference(name)]))
    for (const order of permutations(NAMES)) {
      const made = setup()
      const { render } = createPages(made)
      const pages = Object.fromEntries(order.map((name) => [name, render(name)]))
      for (const name of NAMES) {
        const { css } = extractPageStyles(made.cache, pages[name], {
          themes: [made.lightClass, made.darkClass],
        })
        expect(css, `${name} after ${order.join(', ')}`).toBe(reference[name])
      }
    }
  })

  it('gives the same CSS when pages render at the same time in one process', async () => {
    const made = setup()
    const { render } = createPages(made)
    const results = await Promise.all(
      NAMES.map(async (name, index) => {
        await new Promise((resolve) => setTimeout(resolve, (3 - index) * 3))
        const html = render(name)
        await new Promise((resolve) => setTimeout(resolve, index * 3))
        return [name, html] as const
      })
    )
    for (const [name, html] of results) {
      const { css } = extractPageStyles(made.cache, html, {
        themes: [made.lightClass, made.darkClass],
      })
      expect(css).toBe(createReference(name))
    }
  })

  it('does not change the cache, so a later page is not affected by an earlier extraction', () => {
    const made = setup()
    const { render } = createPages(made)
    const html = render('home')
    const before = made.cache.extract()
    const first = extractPageStyles(made.cache, html, { themes: [made.darkClass] })
    expect(made.cache.extract()).toEqual(before)
    expect(extractPageStyles(made.cache, html, { themes: [made.darkClass] })).toEqual(first)
    render('catalog')
    expect(extractPageStyles(made.cache, html, { themes: [made.darkClass] }).css).toBe(first.css)
  })

  it('writes the theme classes in the order of their names, however they are offered', () => {
    const made = setup()
    const html = '<main></main>'
    const [first, second] = [made.darkClass, made.lightClass]
      .map((name) => name.split(' ')[0])
      .sort((x, y) => (x < y ? -1 : 1))
    const ordered = extractPageStyles(made.cache, html, { themes: [first, second] })
    const reversed = extractPageStyles(made.cache, html, { themes: [second, first] })
    expect(reversed).toEqual(ordered)
    const themeIds = ordered.ids.filter((id) => id.startsWith('u-theme-'))
    expect(themeIds).toEqual([first, second])
  })

  it('includes the themes it is told to, with the same variables as the theme of the page', () => {
    const made = setup()
    const html = createPages(made).render('home')
    const { css } = extractPageStyles(made.cache, html, {
      themes: [made.darkClass, `${made.darkClass}  ${made.lightClass}`],
    })
    const darkId = made.darkClass.split(' ')[0]
    // The dark theme gives no space token, so only the palette variable of the page is written.
    expect(css).toContain(`.${darkId}{--u-palette-primary:#8888ff;color-scheme:dark;}`)
    expect(css.match(new RegExp(`\\.${darkId}\\{`, 'g'))).toHaveLength(1)
    expect(extractPageStyles(made.cache, html).css).not.toContain(darkId)
  })

  it('puts a props class after its base class, whatever their names sort like', () => {
    for (let label = 0; label < 40; label++) {
      const made = setup()
      const styler = made.engine.createStyler({ name: `x${label}` }, [
        { margin: 1 },
        ({ tone }: { tone?: string }) => ({ padding: tone ? 2 : 3 }),
      ])
      const names = styler.getClassName({}, undefined, made.engine.refs).split(' ')
      const { css } = extractPageStyles(made.cache, `<p class="${names.join(' ')}">`)
      expect(css.indexOf(`.${names[0]}{`)).toBeGreaterThan(-1)
      expect(css.indexOf(`.${names[0]}{`)).toBeLessThan(css.indexOf(`.${names[1]}{`))
      // The order is the same when the classes are listed the other way round.
      const reversed = extractPageStyles(
        made.cache,
        `<p class="${[...names].reverse().join(' ')}">`
      )
      expect(reversed.css).toBe(css)
    }
  })

  it('orders unrelated classes by name and classes of two bases by base', () => {
    const made = setup()
    const names = [1, 2, 3, 4].flatMap((index) =>
      made.engine
        .createStyler({ name: `c${index}` }, [
          { margin: index },
          ({ tone }: { tone?: string }) => ({ padding: tone ? 0 : index }),
        ])
        .getClassName({}, undefined, made.engine.refs)
        .split(' ')
    )
    const { css } = extractPageStyles(made.cache, `<p class="${names.join(' ')}">`)
    const found = [...css.matchAll(/\.(u-c\d-root-\w+)\{/g)].map((match) => match[1])
    const bases = new Set(names.filter((_, index) => index % 2 === 0))
    // Each base is followed by its own props class.
    for (let index = 0; index < found.length; index += 2) expect(bases.has(found[index])).toBe(true)
    const again = extractPageStyles(made.cache, `<p class="${[...names].reverse().join(' ')}">`)
    expect(again.css).toBe(css)
  })

  it('writes the @property rules of the registered variables the page uses, and no other', () => {
    const made = setup({})
    const engine = createEngine<Palette>(light, {
      prefix: 'u',
      cache: made.cache,
      registered: { 'palette.accent': true, 'palette.primary': true },
    })
    const styler = engine.createStyler({ name: 'Reg' }, [{ color: engine.refs.palette.accent }])
    const { css } = extractPageStyles(made.cache, `<p class="${styler.getClassName({})}">`)
    expect(css).toContain('@property --u-palette-accent{')
    expect(css).not.toContain('@property --u-palette-primary')
    expect(css.indexOf('@property')).toBeGreaterThan(css.indexOf('@layer u-theme,'))
  })

  it('writes a scoped condition with the class of the component', () => {
    const made = setup()
    const styler = made.engine.createStyler({ name: 'Scoped' }, [
      { color: 'red', [made.engine.when(dark, 'dark')]: { color: 'white' } } as WebStyleObject,
    ])
    const html = `<p class="${styler.getClassName({})} ${made.lightClass}">`
    const { css } = extractPageStyles(made.cache, html)
    expect(css).toMatch(
      /@scope \(\.u-theme-\w+\) to \(\.u-boundary\)\{\.u-scoped-root-\w+\{color:white;\}\}/
    )
  })

  it('includes a variable that a value of the theme refers to, and one that was marked from outside', () => {
    const made = setup()
    const styler = made.engine.createStyler({ name: 'Alias' }, [
      {
        color: made.engine.refs.palette.alias,
        background: made.engine.refs.palette.text,
        borderColor: made.engine.refs.palette.alias2,
      },
    ])
    made.cache.markUsed(['--u-space-1'])
    const { css } = extractPageStyles(made.cache, `<p class="${styler.getClassName({})}">`, {
      themes: [made.lightClass],
    })
    const rule = css.match(/@layer u-theme\{\.u-theme-\w+\{([^}]*)\}\}/)?.[1] ?? ''
    expect(rule).toBe(
      '--u-palette-primary:#0000ff;--u-palette-text:#000000;--u-palette-alias:var(--u-palette-text);--u-palette-alias2:var(--u-palette-primary);--u-space-1:4px;color-scheme:light;'
    )
  })

  it('ignores names that the cache made no rules for, and class names that only appear elsewhere', () => {
    const made = setup()
    const name = made.engine.css({ color: 'red' })
    const html =
      `<p class="u-unknown plain ${name}" title="u-other" data-x="${made.lightClass}">` +
      `<script>var a = '<i class="u-hidden">'</script>`
    const { css, ids } = extractPageStyles(made.cache, html)
    expect(ids).toEqual([name])
    expect(css).not.toContain('u-unknown')
    expect(css).not.toContain(made.lightClass.split(' ')[0])
  })

  it('leaves out the rules of the style elements that the markup carries, and covers their variables', () => {
    const made = setup()
    const { render } = createPages(made)
    const html = render('home')
    const all = extractPageStyles(made.cache, html)
    const classes = all.ids.filter((id) => !id.includes('theme'))
    const theme = all.ids.find((id) => id.includes('theme')) as string
    const carried = `<style data-precedence="u" data-href="${[theme, ...classes].join(' ')}"></style>`
    const rest = extractPageStyles(made.cache, `${carried}${html}`, { themes: [made.darkClass] })
    expect(rest.ids).toEqual([made.darkClass.split(' ')[0]])
    expect(rest.css).toContain('color-scheme:dark;')
    // The dark theme still has the variables of the classes that the markup carries.
    expect(rest.css).toContain('--u-palette-primary:#8888ff;color-scheme:dark;')
    expect(rest.css).not.toContain('font:inherit')
  })

  it('leaves the @property rules of a carried theme to it', () => {
    const made = setup({})
    const engine = createEngine<Palette>(light, {
      prefix: 'u',
      cache: made.cache,
      registered: { 'palette.accent': true, 'palette.primary': true },
    })
    const styler = engine.createStyler({ name: 'Reg' }, [{ color: engine.refs.palette.accent }])
    const html = `<p class="${styler.getClassName({})} ${made.lightClass}">`
    const full = extractPageStyles(made.cache, html)
    expect(full.css).toContain('@property --u-palette-accent')
    const theme = made.lightClass.split(' ')[0]
    const carried = extractPageStyles(
      made.cache,
      `<style data-precedence="u" data-href="${theme}"></style>${html}`
    )
    expect(carried.css).not.toContain('@property')
    expect(carried.css).not.toContain(theme)
  })

  it('writes nothing for a page that has no class of the cache, and no order statement without a rule in a layer', () => {
    const made = setup()
    expect(extractPageStyles(made.cache, '<p class="a">hello</p>').css).toBe('')
    expect(extractPageStyles(made.cache, '<p class="a">hello</p>').tag).toBe(
      `<style data-style="u" data-options="${made.cache.fingerprint}"></style>`
    )
  })

  it('works without layers', () => {
    const made = setup({ hasLayers: false })
    const html = createPages(made).render('settings')
    const { css } = extractPageStyles(made.cache, html)
    expect(css).not.toContain('@layer')
    expect(css).toContain('--u-palette-accent:#ff0000;')
    expect(css).toMatch(/\.u-hero-root-\w+\{color:var\(--u-palette-accent\);\}/)
  })

  it('writes every variable of a theme class when the cache does not prune, and the properties of its themes', () => {
    const made = setup({ hasPruning: false })
    const engine = createEngine<Palette>(light, {
      prefix: 'u',
      cache: made.cache,
      registered: { 'palette.accent': true, 'palette.primary': true },
    })
    const styler = engine.createStyler({ name: 'Plain' }, [{ margin: 1 }])
    const { css } = extractPageStyles(made.cache, `<p class="${styler.getClassName({})}">`, {
      themes: [made.darkClass],
    })
    expect(css).toContain('--u-palette-primary:#8888ff;--u-palette-text:#ffffff;')
    expect(css).toContain('@property --u-palette-primary{')
  })

  it('writes no rule for a theme class that has no variable to declare and no color-scheme', () => {
    const made = setup()
    const plain = made.engine.themeClass({ palette: { text: '#111111' } })
    const { css, ids } = extractPageStyles(made.cache, '<p class="a">', { themes: [plain] })
    expect(css).toBe('')
    expect(ids).toEqual([plain.split(' ')[0]])
  })

  it('takes a theme that nothing in the markup mentions and no class of the cache for nothing', () => {
    const made = setup()
    const { cache } = made as { cache: Cache; engine: Engine<Palette> }
    expect(extractPageStyles(cache, '', { themes: ['nope'] }).css).toBe('')
  })
})
