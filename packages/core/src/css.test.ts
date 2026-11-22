import { createCache, createMemorySheet } from './cache'
import { createLazyEngine } from './createEngine'
import {
  createComponentSelector,
  createCssEntry,
  readCssStyle,
  readStaticTemplate,
  readStyleArguments,
  rejectFunctions,
} from './css'
import { createSheetEntry, isSheetEntry } from './sheetEntry'

/** The arguments a tag is given, as an array: what `css` and `styled` receive as rest arguments. */
const args = (strings: TemplateStringsArray, ...values: unknown[]): unknown[] => [
  strings,
  ...values,
]

const setup = () => {
  const sheet = createMemorySheet()
  return { sheet, cache: createCache({ prefix: 'c', sheet, hasLayers: false }) }
}

describe('readStaticTemplate', () => {
  it('reads a template as CSS text, and gives undefined for anything else', () => {
    expect(readStaticTemplate(args`color: ${'red'}; &:hover { opacity: 0.5 }`, 'css')).toEqual({
      color: 'red',
      '&:hover': { opacity: '0.5' },
    })
    expect(readStaticTemplate([{ color: 'red' }], 'css')).toBeUndefined()
    expect(readStaticTemplate([], 'css')).toBeUndefined()
    expect(readStaticTemplate([['color: red']], 'css')).toBeUndefined()
  })

  it('throws a TypeError that names the caller for a function among the interpolations', () => {
    expect(() => readStaticTemplate(args`color: ${() => 'red'};`, 'keyframes')).toThrow(
      new TypeError(
        'keyframes(): an interpolation of this template is a function, which needs props, and keyframes() has none. Use the template with styled, or call the function yourself and interpolate what it returns.'
      )
    )
  })
})

describe('rejectFunctions', () => {
  it('throws for a function, or one in a list, and passes anything else', () => {
    expect(() => rejectFunctions([{ color: 'red' }, [null, [false]]], 'css')).not.toThrow()
    expect(() => rejectFunctions([() => ({})], 'css')).toThrow(
      new TypeError(
        'css(): a function is not a style here, because css() has no props. Give it to styled, or call it yourself and pass what it returns.'
      )
    )
    expect(() => rejectFunctions([[{}, [() => ({})]]], 'css')).toThrow(TypeError)
  })
})

describe('readCssStyle', () => {
  it('merges objects, entries and lists in order, the last winning, and drops what is falsy', () => {
    const { cache } = setup()
    const entry = cache.createEntry({ color: 'blue', margin: 1 })
    expect(
      readCssStyle([
        { color: 'red', padding: 1 },
        [false, null, undefined, [entry]],
        { padding: 2 },
      ])
    ).toEqual({ color: 'blue', padding: 2, margin: 1 })
  })

  it('merges nested styles key by key', () => {
    expect(
      readCssStyle([{ '&:hover': { color: 'red', opacity: 1 } }, { '&:hover': { opacity: 0 } }])
    ).toEqual({ '&:hover': { color: 'red', opacity: 0 } })
  })

  it('finds an entry that a framework merged into an object, with findEntry', () => {
    const { cache } = setup()
    const entry = cache.createEntry({ color: 'blue' })
    expect(readCssStyle([{ ...entry, opacity: 1 }], cache.findEntry)).toEqual({
      color: 'blue',
      opacity: 1,
    })
  })

  it('reads a template as CSS text', () => {
    expect(readCssStyle(args`padding: 8px;`)).toEqual({ padding: '8px' })
  })

  it('throws a TypeError for a function, a string and an entry that is only a class name', () => {
    expect(() => readCssStyle([() => ({ color: 'red' })])).toThrow(TypeError)
    expect(() => readCssStyle(['color: red'])).toThrow('cannot be merged into a class')
    expect(() => readCssStyle([createSheetEntry('foreign')])).toThrow(
      new TypeError(
        'css(): the sheet entry "foreign" is only a class name, so its style cannot be merged.'
      )
    )
  })
})

describe('createCssEntry', () => {
  it('makes an entry of the merged style, which writes its rule when it is first used', () => {
    const { cache, sheet } = setup()
    const entry = createCssEntry(cache, [{ color: 'red' }, { padding: 1 }])
    expect(isSheetEntry(entry)).toBe(true)
    expect(sheet.rules).toEqual([])
    expect(String(entry)).toMatch(/^c-/)
    expect(sheet.rules).toEqual([`.${entry.className}{color:red;padding:1px;}`])
  })

  it('gives equal styles the same class, whichever way they were written', () => {
    const { cache } = setup()
    const first = createCssEntry(cache, [{ color: 'red', padding: 1 }])
    const second = createCssEntry(cache, [
      { color: 'red' },
      createCssEntry(cache, [{ padding: 1 }]),
    ])
    const third = createCssEntry(cache, args`color: red; padding: 1px;`)
    expect(second.className).toBe(first.className)
    expect(third.className).toBe(first.className)
  })

  it('gives an entry with no class for nothing', () => {
    const { cache } = setup()
    expect(String(createCssEntry(cache, []))).toBe('')
    expect(String(createCssEntry(cache, [false, null]))).toBe('')
    expect(createCssEntry(cache, []).name).toBe('')
    expect(createCssEntry(cache, []).styles).toBe('')
  })

  it('has the class name it is used under alone as its name, and the text of its style, with no rule written', () => {
    const { cache, sheet } = setup()
    const value = createCssEntry(cache, [
      {
        color: 'red',
        border: 'none',
        boxShadow: '0 1px 2px black',
        width: 'calc(1px + 2px)',
        '&::backdrop': { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
        '@media (min-width: 40em)': { padding: 16, '&:hover': { opacity: 0.5 } },
      },
    ])
    expect(value.styles).toBe(
      'color:red;border:none;box-shadow:0 1px 2px black;width:calc(1px + 2px);&::backdrop{background-color:rgba(0, 0, 0, 0.5);}@media (min-width: 40em){&{padding:16px;}}@media (min-width: 40em){&:hover{opacity:0.5;}}'
    )
    expect(value.name).toMatch(/^c-\w+$/)
    expect(sheet.rules).toEqual([])
    expect(value.className).toBe(value.name)
    expect(sheet.rules[0]).toBe(
      `.${value.name}{color:red;border:none;box-shadow:0 1px 2px black;width:calc(1px + 2px);}`
    )
  })

  it('writes the nested rules alone when the style declares nothing of its own', () => {
    const { cache } = setup()
    expect(createCssEntry(cache, [{ '&:hover': { color: 'red' } }]).styles).toBe(
      '&:hover{color:red;}'
    )
  })
})

describe('readStyleArguments', () => {
  it('gives the styles given, with lists flattened', () => {
    const fn = () => ({ color: 'red' })
    expect(readStyleArguments([{ margin: 1 }, [fn, [false]]])).toEqual([{ margin: 1 }, fn, false])
  })

  it('gives one style for a template: an object, or a function of the props', () => {
    expect(readStyleArguments(args`margin: 1px;`)).toEqual([{ margin: '1px' }])
    const [style] = readStyleArguments(args`color: ${(props: { tone: string }) => props.tone};`)
    expect(typeof style).toBe('function')
    expect((style as (props: object) => object)({ tone: 'red' })).toEqual({ color: 'red' })
  })
})

describe('createComponentSelector', () => {
  it('is the target when one was given, each of its classes', () => {
    const engine = createLazyEngine({ prefix: 'c' })
    const styler = engine.createStyler({}, [() => ({ color: 'red' })])
    expect(createComponentSelector('my-button', styler)()).toBe('.my-button')
    expect(createComponentSelector(' a  b ', styler)()).toBe('.a.b')
  })

  it('is the class of a component whose styles are all objects', () => {
    const engine = createLazyEngine({ prefix: 'c' })
    const styler = engine.createStyler({ name: 'Button' }, [{ color: 'red' }])
    expect(createComponentSelector(undefined, styler)()).toBe(`.${styler.getClassName({})}`)
    expect(createComponentSelector(undefined, styler)()).toMatch(/^\.c-button-root-/)
  })

  it('throws a TypeError that asks for a target when no class is on every element', () => {
    const engine = createLazyEngine({ prefix: 'c' })
    const message =
      'A styled component used as a selector needs a class that every element of it has: give it a `target` (styled(tag, { target: "my-button" })), or write its styles without functions.'
    const dynamic = engine.createStyler({}, [() => ({ color: 'red' })])
    expect(createComponentSelector(undefined, dynamic)).toThrow(new TypeError(message))
    const empty = engine.createStyler({}, [{}])
    expect(createComponentSelector(undefined, empty)).toThrow(new TypeError(message))
  })
})
