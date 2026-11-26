import { createCache, createDomSheet, createMemorySheet } from './cache'
import { add, divide, multiply, negate, subtract } from './calc'
import {
  createLiveValue,
  declareLiveValue,
  isLiveValue,
  readLiveName,
  readLiveText,
  writeLiveValue,
} from './liveValue'

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

/** The rules of the style element of the values of `prefix`, as the browser writes them. */
const readValueRules = (prefix: string, page: Document = document) => [
  ...((page.head.querySelector(`style[data-style="${prefix}-values"]`) as HTMLStyleElement | null)
    ?.sheet?.cssRules ?? []),
]

describe('a live value', () => {
  it('holds its data only, and gets its get and toString from one prototype that every value shares', () => {
    const first = createLiveValue('--a-value-1', 0)
    const second = createLiveValue('--a-value-2', 4, 'px')
    expect(first.get).toBe(second.get)
    expect(first.toString).toBe(second.toString)
    expect(Object.keys(first)).toEqual(['name', 'reference', 'unit', 'current'])
    expect(Object.values(first).some((member) => typeof member === 'function')).toBe(false)
    expect([first.get(), second.get()]).toEqual([0, 4])
  })

  it('is the reference to its variable in text, with the first value as its fallback', () => {
    const left = createLiveValue('--a-value-1', 12, '%')
    expect(String(left)).toBe('var(--a-value-1, 12%)')
    expect(`${left}`).toBe('var(--a-value-1, 12%)')
    expect(readLiveName(left)).toBe('--a-value-1')
    expect(readLiveText(left)).toBe('12%')
    expect(writeLiveValue(left, 40)).toBe('40%')
    // The reference stays: the class that uses it is the same whatever the value holds.
    expect(String(left)).toBe('var(--a-value-1, 12%)')
    expect(left.get()).toBe(40)
  })

  it('is told apart from other values, also those of another copy of the core', () => {
    expect(isLiveValue(createLiveValue('--a-value-1', 0))).toBe(true)
    expect(isLiveValue({ [Symbol.for('umber-style.live-value')]: true })).toBe(true)
    expect([isLiveValue('var(--x)'), isLiveValue(null), isLiveValue(3)]).toEqual([
      false,
      false,
      false,
    ])
  })

  it('throws for a number that is not finite and for a unit that is not one', () => {
    expect(() => createLiveValue('--a', Number.NaN)).toThrow(
      new TypeError('useStyleValue(): a value must be a finite number, got NaN.')
    )
    expect(() => createLiveValue('--a', '1' as unknown as number)).toThrow(TypeError)
    expect(() => writeLiveValue(createLiveValue('--a', 0), Infinity)).toThrow(TypeError)
    expect(() => createLiveValue('--a', 0, 'p x')).toThrow(
      new TypeError('useStyleValue(): the unit "p x" is not one: use % or letters, such as px.')
    )
  })

  it('is an operand of the helpers of tokens, as the reference to its variable', () => {
    const left = createLiveValue('--a-value-1', 0)
    expect(multiply(left, 2)).toBe('calc(var(--a-value-1, 0) * 2)')
    expect(divide(left, 2)).toBe('calc(var(--a-value-1, 0) / 2)')
    expect(negate(left)).toBe('calc(var(--a-value-1, 0) * -1)')
    expect(add(left)).toBe('var(--a-value-1, 0)')
    expect(add(left, '1px')).toBe('calc(var(--a-value-1, 0) + 1px)')
    expect(subtract(left, 4)).toBe('calc(var(--a-value-1, 0) - 4px)')
    expect(subtract('100%', left)).toBe('calc(100% - var(--a-value-1, 0))')
  })
})

describe('the rule of a live value', () => {
  it('declares the variable on :root in the theme layer, in the element of the values, and changes it in place', () => {
    const cache = createCache({ prefix: 'lv', nonce: 'n0nce' })
    const left = createLiveValue('--lv-value-1', 4, 'px')
    const rule = declareLiveValue(cache, left)
    const element = document.head.querySelector('style[data-style="lv-values"]')
    expect(element?.getAttribute('nonce')).toBe('n0nce')
    const [outer] = readValueRules('lv') as CSSGroupingRule[]
    expect(outer.cssText.replaceAll(/\s+/g, '')).toBe('@layerlv-theme{:root{--lv-value-1:4px;}}')
    rule.set(writeLiveValue(left, 9))
    expect(readValueRules('lv')).toEqual([outer])
    expect((outer.cssRules[0] as CSSStyleRule).style.getPropertyValue('--lv-value-1')).toBe('9px')
    rule.remove()
    rule.remove()
    expect(readValueRules('lv')).toEqual([])
  })

  it('makes the element of the values with the nonce of the page when the cache has none', () => {
    const script = document.createElement('script')
    script.setAttribute('nonce', 'page')
    document.head.append(script)
    declareLiveValue(createCache({ prefix: 'lp' }), createLiveValue('--lp-value-1', 1))
    declareLiveValue(
      createCache({ prefix: 'lo', nonce: 'mine' }),
      createLiveValue('--lo-value-1', 1)
    )
    const readNonce = (key: string) =>
      document.head.querySelector(`style[data-style="${key}"]`)?.getAttribute('nonce')
    expect(readNonce('lp-values')).toBe('page')
    expect(readNonce('lo-values')).toBe('mine')
  })

  it('puts each value in a rule of its own, in one element, outside every layer without layers', () => {
    const cache = createCache({ prefix: 'lw', hasLayers: false })
    const first = declareLiveValue(cache, createLiveValue('--lw-value-1', 1))
    declareLiveValue(cache, createLiveValue('--lw-value-2', 2))
    expect(document.head.querySelectorAll('style[data-style="lw-values"]')).toHaveLength(1)
    const rules = readValueRules('lw') as CSSStyleRule[]
    expect(rules.map((rule) => rule.style.getPropertyValue(rule.style[0]))).toEqual(['1', '2'])
    first.set('5')
    expect(rules[0].style.getPropertyValue('--lw-value-1')).toBe('5')
    first.remove()
    expect((readValueRules('lw') as CSSStyleRule[]).map((rule) => rule.selectorText)).toEqual([
      ':root',
    ])
  })

  it('goes into the document of the cache, and leaves a rule that was taken out already', () => {
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const frame = iframe.contentDocument as Document
    const cache = createCache({ prefix: 'lf', sheet: createDomSheet('lf', frame.head) })
    const rule = declareLiveValue(cache, createLiveValue('--lf-value-1', 1))
    expect(readValueRules('lf', frame)).toHaveLength(1)
    expect(readValueRules('lf')).toEqual([])
    const sheet = (frame.head.querySelector('style[data-style="lf-values"]') as HTMLStyleElement)
      .sheet as CSSStyleSheet
    sheet.deleteRule(0)
    rule.remove()
    expect(readValueRules('lf', frame)).toEqual([])
  })

  it('makes no rule where the cache has no document', () => {
    const cache = {
      ...createCache({ prefix: 'ln', sheet: createMemorySheet() }),
      document: undefined,
    }
    const rule = declareLiveValue(cache, createLiveValue('--ln-value-1', 1))
    rule.set('2')
    rule.remove()
    expect(document.head.querySelector('style')).toBeNull()
  })
})
