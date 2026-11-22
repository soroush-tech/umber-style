import { types } from 'node:util'
import { createCache, createMemorySheet, type CacheOptions } from './cache'
import { createEngine } from './createEngine'
import type { StyleInput } from './types'

const theme = {
  palette: { primary: '#0000ff', text: '#111111' },
  space: [0, 4, 8],
  breakpoints: { md: 768 },
  isDense: false,
}
type AppTheme = typeof theme

function setup(options: CacheOptions = {}) {
  const sheet = createMemorySheet()
  const cache = createCache({ hasPruning: false, prefix: 'b', sheet, ...options })
  const engine = createEngine(theme, { prefix: 'b', cache })
  /** The layer-wrapped rule texts, in the order they were written, without the layer order statement. */
  const rules = () => sheet.rules.filter((rule) => !rule.startsWith('@layer b-theme,'))
  const indexOf = (className: string) =>
    sheet.rules.findIndex((rule) => rule.includes(`.${className}{`))
  return { engine, sheet, cache, rules, indexOf }
}

const byTone = ({ tone }: { tone?: string }) => ({ color: tone })
const asStyles = (...styles: unknown[]) => styles as StyleInput[]

describe('the base class and the props class', () => {
  it('splits by position: the leading plain objects are the base, from the first props function on is the props class', () => {
    const { engine, rules } = setup()
    const styler = engine.createStyler(
      { name: 'Flex' },
      asStyles({ display: 'flex' }, byTone, { gap: 4 })
    )
    const [base, props, ...rest] = styler.getClassName({ tone: 'red' }).split(' ')
    expect(rest).toEqual([])
    expect(base).toMatch(/^b-flex-root-/)
    expect(props).toMatch(/^b-flex-root-/)
    expect(props).not.toBe(base)
    expect(rules()).toEqual([
      `@layer b-components{.${base}{display:flex;}}`,
      `@layer b-components{.${props}{color:red;gap:4px;}}`,
    ])
  })

  it('computes the base once and gives one props class for each distinct result', () => {
    const { engine, rules } = setup()
    const styler = engine.createStyler({}, asStyles({ display: 'flex' }, byTone))
    const red = styler.getClassName({ tone: 'red' })
    const blue = styler.getClassName({ tone: 'blue' })
    expect(styler.getClassName({ tone: 'red' })).toBe(red)
    expect(red.split(' ')[0]).toBe(blue.split(' ')[0])
    expect(red.split(' ')[1]).not.toBe(blue.split(' ')[1])
    expect(rules().filter((rule) => rule.includes('display:flex'))).toHaveLength(1)
    expect(rules()).toHaveLength(3)
  })

  it('makes only the base for plain objects, and only the props class when the list starts with a props function', () => {
    const { engine } = setup()
    expect(
      engine
        .createStyler({}, [{ display: 'flex' }])
        .getClassName({})
        .split(' ')
    ).toHaveLength(1)
    const first = engine.createStyler({ name: 'Tone' }, asStyles(byTone))
    expect(first.getClassName({ tone: 'red' }).split(' ')).toHaveLength(1)
    expect(first.getClassName({})).toBe('')
  })

  it('gives a component with no function the class it had: the merged list, under its label', () => {
    const { engine, rules } = setup()
    const styler = engine.createStyler({ name: 'Box' }, [{ color: 'red' }, { margin: 4 }])
    const className = styler.getClassName({})
    expect(rules()).toEqual([`@layer b-components{.${className}{color:red;margin:4px;}}`])
    const whole = setup({ hasBaseClass: false })
    const same = whole.engine.createStyler({ name: 'Box' }, [{ color: 'red' }, { margin: 4 }])
    expect(same.getClassName({})).toBe(className)
  })

  it('has the old output without hasBaseClass: one class for the whole list', () => {
    const { engine, rules, cache } = setup({ hasBaseClass: false })
    expect(cache.hasBaseClass).toBe(false)
    const styler = engine.createStyler({}, asStyles({ display: 'flex' }, byTone, { gap: 4 }))
    const className = styler.getClassName({ tone: 'red' })
    expect(className.split(' ')).toHaveLength(1)
    expect(rules()).toEqual([`@layer b-components{.${className}{display:flex;color:red;gap:4px;}}`])
    expect(setup().cache.hasBaseClass).toBe(true)
  })

  it('takes the option through the engine, and through a given cache', () => {
    const own = createEngine(theme, { prefix: 'o', hasBaseClass: false })
    expect(own.cache.hasBaseClass).toBe(false)
    expect(createEngine(theme).cache.hasBaseClass).toBe(true)
  })

  it('keeps the label out of the base when the list goes on with a props function, and on the props class', () => {
    const { engine } = setup()
    const styler = engine.createStyler({ name: 'Tone' }, asStyles({ margin: 1 }, byTone))
    const [base, props] = styler.getClassName({ tone: 'red' }).split(' ')
    expect(base).toMatch(/^b-tone-root-/)
    expect(props).toMatch(/^b-tone-root-/)
    const unnamed = engine.createStyler({}, asStyles({ margin: 1 }, byTone))
    const names = unnamed.getClassName({ tone: 'red' }).split(' ')
    expect(names.every((name) => /^b-[a-z0-9]+$/.test(name))).toBe(true)
  })
})

describe('what the cascade does with two classes of one layer', () => {
  it('lets the props class win a plain property: equal specificity, and it is written after the base', () => {
    const { engine, rules, indexOf } = setup()
    const styler = engine.createStyler({}, asStyles({ color: 'red' }, byTone))
    const [base, props] = styler.getClassName({ tone: 'blue' }).split(' ')
    expect(rules()).toEqual([
      `@layer b-components{.${base}{color:red;}}`,
      `@layer b-components{.${props}{color:blue;}}`,
    ])
    expect(indexOf(base)).toBeLessThan(indexOf(props))
  })

  it('lets a :hover rule of the base beat a plain property of the props class: it is more specific', () => {
    const { engine, rules } = setup()
    const styler = engine.createStyler({}, asStyles({ '&:hover': { color: 'red' } }, byTone))
    const [base, props] = styler.getClassName({ tone: 'blue' }).split(' ')
    expect(rules()).toEqual([
      `@layer b-components{.${base}:hover{color:red;}}`,
      `@layer b-components{.${props}{color:blue;}}`,
    ])
  })

  it('lets the props class win when both have :hover: the same specificity, and it is written after', () => {
    const { engine, rules } = setup()
    const hover = ({ tone }: { tone?: string }) => ({ '&:hover': { color: tone } })
    const styler = engine.createStyler({}, asStyles({ '&:hover': { color: 'red' } }, hover))
    const [base, props] = styler.getClassName({ tone: 'blue' }).split(' ')
    expect(rules()).toEqual([
      `@layer b-components{.${base}:hover{color:red;}}`,
      `@layer b-components{.${props}:hover{color:blue;}}`,
    ])
  })

  it('differs from the merge in one case: a media query of the base no longer beats a plain property of the props', () => {
    const { engine, rules } = setup()
    const styler = engine.createStyler(
      {},
      asStyles({ '@media (width >= 600px)': { color: 'red' } }, byTone)
    )
    const [base, props] = styler.getClassName({ tone: 'blue' }).split(' ')
    // The merge wrote `.m{color:blue}` and then the media rule, which won at 600px. Two classes in one
    // layer have the props class last, and it wins at every width.
    expect(rules()).toEqual([
      `@layer b-components{@media (width >= 600px){.${base}{color:red;}}}`,
      `@layer b-components{.${props}{color:blue;}}`,
    ])
  })

  it('keeps the override class last, in the overrides layer', () => {
    const { engine, rules } = setup()
    const styler = engine.createStyler({}, asStyles({ color: 'red' }, byTone))
    const [base, props, override] = styler
      .getClassName({ tone: 'blue' }, [{ color: 'green' }])
      .split(' ')
    expect(rules().map((rule) => rule.split('{')[0])).toEqual([
      '@layer b-components',
      '@layer b-components',
      '@layer b-overrides',
    ])
    expect([base, props, override].every(Boolean)).toBe(true)
  })
})

describe('the order of the base before the props classes', () => {
  it('holds when two components make the same props result: each props class is named after its own base', () => {
    const { engine, indexOf } = setup({ hasLabels: false })
    const a = engine.createStyler({}, asStyles({ margin: 1 }, byTone))
    const b = engine.createStyler({}, asStyles({ margin: 2 }, byTone))
    const [baseA, propsA] = a.getClassName({ tone: 'red' }).split(' ')
    const [baseB, propsB] = b.getClassName({ tone: 'red' }).split(' ')
    expect(propsA).not.toBe(propsB)
    expect(indexOf(baseA)).toBeLessThan(indexOf(propsA))
    expect(indexOf(baseB)).toBeLessThan(indexOf(propsB))
    // The same styler again, and the same base: the same props class.
    const again = engine.createStyler({}, asStyles({ margin: 1 }, byTone))
    expect(again.getClassName({ tone: 'red' })).toBe(`${baseA} ${propsA}`)
  })

  it('holds when one component has no base and another has the same props result', () => {
    const { engine, indexOf } = setup({ hasLabels: false })
    const bare = engine.createStyler({}, asStyles(byTone))
    const based = engine.createStyler({}, asStyles({ margin: 1 }, byTone))
    const [bareProps] = bare.getClassName({ tone: 'red' }).split(' ')
    const [base, props] = based.getClassName({ tone: 'red' }).split(' ')
    expect(props).not.toBe(bareProps)
    expect(indexOf(base)).toBeLessThan(indexOf(props))
  })

  it('holds without layers: the base is written before its props class, and what comes in is merged into one class', () => {
    const { engine, indexOf, rules } = setup({ hasLayers: false })
    const styler = engine.createStyler({}, asStyles({ color: 'red' }, byTone))
    const [base, props] = styler.getClassName({ tone: 'blue' }).split(' ')
    expect(indexOf(base)).toBeLessThan(indexOf(props))
    expect(rules()).toEqual([`.${base}{color:red;}`, `.${props}{color:blue;}`])
    const merged = styler.getClassName({ tone: 'blue' }, [{ margin: 1 }])
    expect(merged.split(' ')).toHaveLength(1)
  })
})

describe('wrapping a styled component', () => {
  const label = (name: string) => ({ name })

  it('static inner and static outer: one base class for everything, as before', () => {
    const { engine, rules } = setup()
    const inner = engine.createStyler(label('Inner'), [{ color: 'red' }])
    const outer = engine.createStyler(label('Outer'), [{ margin: 1 }], inner.styles)
    const className = outer.getClassName({})
    expect(className).toMatch(/^b-outer-root-/)
    expect(rules()).toEqual([`@layer b-components{.${className}{color:red;margin:1px;}}`])
  })

  it('static and dynamic inner and static outer: the outer has the base of the inner under its own label', () => {
    const { engine, rules } = setup()
    const inner = engine.createStyler(label('Inner'), asStyles({ color: 'red' }, byTone))
    const outer = engine.createStyler(label('Outer'), [{ margin: 1 }], inner.styles)
    const [innerBase] = inner.getClassName({ tone: 'blue' }).split(' ')
    const [outerBase, outerProps, ...rest] = outer.getClassName({ tone: 'blue' }).split(' ')
    expect(rest).toEqual([])
    expect(innerBase).toMatch(/^b-inner-root-/)
    expect(outerBase).toBe(innerBase.replace('inner', 'outer'))
    expect(outerProps).toMatch(/^b-outer-root-/)
    expect(rules().filter((rule) => rule.includes('{color:red;}'))).toEqual([
      `@layer b-components{.${innerBase}{color:red;}}`,
      `@layer b-components{.${outerBase}{color:red;}}`,
    ])
    const written = rules().find((rule) => rule.includes(`.${outerProps}{`))
    expect(written).toBe(`@layer b-components{.${outerProps}{color:blue;margin:1px;}}`)
  })

  it('an outer without a label reuses the base of the inner, and its props class has no label', () => {
    const { engine, rules } = setup()
    const inner = engine.createStyler(label('Inner'), asStyles({ color: 'red' }, byTone))
    const outer = engine.createStyler({}, [{ margin: 1 }], inner.styles)
    const [innerBase] = inner.getClassName({ tone: 'blue' }).split(' ')
    const [outerBase, outerProps] = outer.getClassName({ tone: 'blue' }).split(' ')
    expect(outerBase).toBe(innerBase)
    expect(outerProps).toMatch(/^b-[a-z0-9]+$/)
    expect(rules().filter((rule) => rule.includes(`.${innerBase}{`))).toHaveLength(1)
  })

  it('an outer with the label of the inner, or a cache without labels, has the one base', () => {
    const { engine, rules } = setup()
    const inner = engine.createStyler(label('Same'), [{ color: 'red' }])
    const outer = engine.createStyler(label('Same'), asStyles(byTone), inner.styles)
    const [base, props, ...rest] = outer.getClassName({ tone: 'blue' }).split(' ')
    expect(rest).toEqual([])
    expect(base).toBe(inner.getClassName({}))
    expect(props).toMatch(/^b-same-root-/)
    expect(rules().filter((rule) => rule.includes('color:red'))).toHaveLength(1)

    const plain = setup({ hasLabels: false }).engine
    const plainInner = plain.createStyler(label('Inner'), [{ color: 'red' }])
    const plainOuter = plain.createStyler(label('Outer'), asStyles(byTone), plainInner.styles)
    const [plainBase, ...plainRest] = plainOuter.getClassName({ tone: 'blue' }).split(' ')
    expect(plainBase).toBe(plainInner.getClassName({}))
    expect(plainRest).toHaveLength(1)
  })

  it('dynamic inner and dynamic outer: no base, one props class for both', () => {
    const { engine } = setup()
    const size = ({ size }: { size?: number }) => ({ width: size })
    const inner = engine.createStyler(label('Inner'), asStyles(byTone))
    const outer = engine.createStyler(label('Outer'), asStyles(size), inner.styles)
    const className = outer.getClassName({ tone: 'red', size: 3 })
    expect(className.split(' ')).toHaveLength(1)
    expect(engine.cache.registered.get(className)).toMatchObject({ color: 'red', width: 3 })
  })

  it('static inner and an outer that starts with a props function: the class of the inner, then the base and the props class under the label of the outer', () => {
    const { engine, rules } = setup()
    const inner = engine.createStyler(label('Inner'), [{ color: 'red' }])
    const outer = engine.createStyler(label('Outer'), asStyles(byTone), inner.styles)
    const innerClass = inner.getClassName({})
    const [selector, base, props, ...rest] = outer.getClassName({ tone: 'blue' }).split(' ')
    expect(rest).toEqual([])
    // The class of the inner stays, so that the inner as a selector matches the element as before.
    expect(selector).toBe(innerClass)
    expect(base).toBe(innerClass.replace('inner', 'outer'))
    expect(props).toMatch(/^b-outer-root-/)
    expect(rules().filter((rule) => rule.includes('color:red'))).toHaveLength(2)
    const written = rules().find((rule) => rule.includes(`.${props}{`))
    expect(written).toBe(`@layer b-components{.${props}{color:blue;}}`)
  })

  it('static inner and an outer that starts with plain objects and then has a function: a larger base under the label of the outer', () => {
    const { engine } = setup()
    const inner = engine.createStyler(label('Inner'), [{ color: 'red' }])
    const outer = engine.createStyler(label('Outer'), asStyles({ margin: 1 }, byTone), inner.styles)
    const [base, props] = outer.getClassName({ tone: 'blue' }).split(' ')
    expect(base).toMatch(/^b-outer-root-/)
    expect(engine.cache.registered.get(base)).toMatchObject({ color: 'red', margin: 1 })
    expect(engine.cache.registered.get(props)).toMatchObject({ color: 'blue' })
  })

  it('wrapping twice keeps the same base without labels, and gives each label its own base of the same declarations', () => {
    const { engine } = setup()
    const first = engine.createStyler(label('First'), asStyles({ color: 'red' }, byTone))
    const second = engine.createStyler({}, asStyles(byTone), first.styles)
    const third = engine.createStyler({}, [{ margin: 1 }], second.styles)
    const bases = [first, second, third].map(
      (styler) => styler.getClassName({ tone: 'a' }).split(' ')[0]
    )
    expect(new Set(bases).size).toBe(1)
    const labelled = engine.createStyler(label('Third'), [{ margin: 1 }], second.styles)
    const [base] = labelled.getClassName({ tone: 'a' }).split(' ')
    expect(base).toBe(bases[0].replace('first', 'third'))
  })
})

describe('a base that uses the theme', () => {
  const themed = ({ theme }: { theme: AppTheme }) => ({ color: theme.palette.primary })
  const sized = ({ theme }: { theme: AppTheme }) => ({ width: theme.breakpoints.md })

  it('puts a function that reads only the theme into the base, and stops at one that reads a prop', () => {
    const { engine, rules } = setup()
    const styler = engine.createStyler({}, asStyles({ display: 'flex' }, themed, byTone, themed))
    const [base, props] = styler.getClassName({ tone: 'red' }).split(' ')
    expect(rules()).toEqual([
      `@layer b-components{.${base}{display:flex;color:var(--b-palette-primary);}}`,
      `@layer b-components{.${props}{color:var(--b-palette-primary);}}`,
    ])
  })

  it('is a single class when no function reads a prop: all base', () => {
    const { engine } = setup()
    const styler = engine.createStyler({}, asStyles({ display: 'flex' }, themed))
    expect(styler.isDynamic).toBe(true)
    expect(styler.getClassName({}).split(' ')).toHaveLength(1)
  })

  it('calls the function once for a view, however many renders and props', () => {
    const { engine } = setup()
    const calls: object[] = []
    const counted = ({ theme }: { theme: AppTheme }) => {
      calls.push(theme)
      return { color: theme.palette.primary }
    }
    const styler = engine.createStyler({}, asStyles(counted, byTone))
    const view = engine.createThemeView({ ...theme })
    for (const tone of ['a', 'b', 'c']) styler.getClassName({ tone }, undefined, view)
    expect(calls).toEqual([view])
  })

  it('shares one base class and one rule between views that differ only in token values', () => {
    const { engine, rules } = setup()
    const styler = engine.createStyler({}, asStyles(themed, byTone))
    const light = engine.createThemeView({ ...theme })
    const dark = engine.createThemeView({
      ...theme,
      palette: { primary: '#111111', text: '#eeeeee' },
    })
    const a = styler.getClassName({ tone: 'x' }, undefined, light).split(' ')
    const b = styler.getClassName({ tone: 'x' }, undefined, dark).split(' ')
    expect(a).toEqual(b)
    expect(rules().filter((rule) => rule.includes('var(--b-palette-primary)'))).toHaveLength(1)
  })

  it('makes a base for each view when a raw value of the theme is in a rule', () => {
    const { engine } = setup()
    const styler = engine.createStyler({}, asStyles(sized, byTone))
    const narrow = engine.createThemeView({ ...theme })
    const wide = engine.createThemeView({ ...theme, breakpoints: { md: 900 } })
    const [narrowBase] = styler.getClassName({ tone: 'x' }, undefined, narrow).split(' ')
    const [wideBase] = styler.getClassName({ tone: 'x' }, undefined, wide).split(' ')
    expect(narrowBase).not.toBe(wideBase)
    expect(engine.cache.registered.get(narrowBase)).toEqual({ width: 768 })
    expect(engine.cache.registered.get(wideBase)).toEqual({ width: 900 })
  })

  it('decides for each view: a function that reads a prop only for one view is in the base for the other', () => {
    const { engine } = setup()
    const branch = (props: { theme: AppTheme; tone?: string }) =>
      props.theme.isDense ? { color: props.tone } : { color: 'gray' }
    const styler = engine.createStyler({}, asStyles(branch))
    const sparse = engine.createThemeView({ ...theme })
    const dense = engine.createThemeView({ ...theme, isDense: true })
    expect(styler.getClassName({ tone: 'red' }, undefined, sparse).split(' ')).toHaveLength(1)
    const denseClasses = styler.getClassName({ tone: 'red' }, undefined, dense)
    expect(engine.cache.registered.get(denseClasses)).toEqual({ color: 'red' })
    expect(
      engine.cache.registered.get(styler.getClassName({ tone: 'red' }, undefined, sparse))
    ).toEqual({
      color: 'gray',
    })
  })

  it('stops tracking a view once its parts are known: the props part gets the plain props object', () => {
    const { engine } = setup()
    const seen: object[] = []
    const reader = (props: { tone?: string }) => {
      seen.push(props)
      return { color: props.tone }
    }
    const styler = engine.createStyler({}, asStyles(reader))
    const view = engine.createThemeView({ ...theme })
    styler.getClassName({ tone: 'a' }, undefined, view)
    styler.getClassName({ tone: 'b' }, undefined, view)
    // The first call is the one that works out the view, with the tracker; the two renders get the props.
    expect(seen.map((props) => types.isProxy(props))).toEqual([true, false, false])
  })

  it('works against the references of the base theme when no view is given', () => {
    const { engine, rules } = setup()
    const styler = engine.createStyler({}, asStyles(themed))
    const className = styler.getClassName({})
    expect(rules()).toEqual([`@layer b-components{.${className}{color:var(--b-palette-primary);}}`])
    expect(styler.getClassName({})).toBe(className)
  })

  it('keeps the old output without hasBaseClass: the function is part of the one class', () => {
    const { engine, rules } = setup({ hasBaseClass: false })
    const styler = engine.createStyler({}, asStyles({ display: 'flex' }, themed))
    const className = styler.getClassName({})
    expect(rules()).toEqual([
      `@layer b-components{.${className}{display:flex;color:var(--b-palette-primary);}}`,
    ])
  })
})
