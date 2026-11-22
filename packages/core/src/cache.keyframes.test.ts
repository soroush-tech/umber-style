import { createCache, createMemorySheet } from './cache'
import { createStyleTag, extractPageStyles } from './extractStyles'
import { keyframes } from './keyframes'
import { createThemeClass } from './theme'

afterEach(() => {
  document.head.innerHTML = ''
})

const pulse = keyframes({ '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } }, { label: 'pulse' })
const spin = keyframes({ to: { transform: 'rotate(360deg)' } }, { label: 'spin' })
const tint = keyframes({ to: { color: 'var(--u-a)' } }, { label: 'tint' })
const pulseRule = `@keyframes ${pulse}{0%{opacity:1;}50%{opacity:0.4;}100%{opacity:1;}}`
const spinRule = `@keyframes ${spin}{100%{transform:rotate(360deg);}}`
const tintRule = `@keyframes ${tint}{100%{color:var(--u-a);}}`

function setup(options: { hasLayers?: boolean; hasPruning?: boolean } = {}) {
  const sheet = createMemorySheet()
  const cache = createCache({ prefix: 'u', sheet, ...options })
  return { cache, sheet }
}

const keyframesRules = (rules: readonly string[]) =>
  rules.filter((rule) => rule.startsWith('@keyframes'))

/** The rules of `byName`, in the order of their names. */
const inOrder = (byName: Record<string, string>) =>
  Object.keys(byName)
    .sort()
    .map((name) => byName[name])
    .join('')

describe('keyframes in a cache', () => {
  it('writes a rule once, outside every layer, when a class that uses it is first inserted', () => {
    const { cache, sheet } = setup()
    expect(sheet.rules).toEqual([])
    const first = cache.css({ animationName: pulse, animationDuration: 1500 })
    const second = cache.css({ animation: `${pulse} 2s ease-in-out infinite`, color: 'red' })
    cache.css({ animationName: pulse, animationDuration: 1500 })
    expect(sheet.rules).toEqual([
      cache.layerOrder,
      pulseRule,
      `@layer u-components{.${first}{animation-name:${pulse};animation-duration:1500ms;}}`,
      `@layer u-components{.${second}{animation:${pulse} 2s ease-in-out infinite;color:red;}}`,
    ])
  })

  it('writes nothing for a name that no class uses', () => {
    const { cache, sheet } = setup({ hasLayers: false })
    cache.css({ color: 'red', '--x': pulse })
    cache.insertOnce('base', ['body{margin:0;}'])
    expect(keyframesRules(sheet.rules)).toEqual([])
  })

  it('writes the rules of a use inside a nested selector and inside an at-rule', () => {
    const { cache, sheet } = setup({ hasLayers: false })
    cache.css({
      color: 'red',
      '&:hover': { animation: `${spin} 1s linear` },
      '@media (prefers-reduced-motion: no-preference)': { animationName: pulse },
    })
    expect(keyframesRules(sheet.rules)).toEqual([spinRule, pulseRule])
  })

  it('passes a name it did not register through, as written', () => {
    const { cache, sheet } = setup({ hasLayers: false })
    const name = cache.css({ animation: 'app-own 1s' })
    expect(sheet.rules).toEqual([`.${name}{animation:app-own 1s;}`])
  })

  it('writes the rule of a sheet entry when the entry is first used, and records what a class uses', () => {
    const { cache, sheet } = setup({ hasLayers: false })
    const entry = cache.createEntry({ animation: `${spin} 1s, ${pulse} 2s` })
    expect(sheet.rules).toEqual([])
    const name = cache.css(entry)
    expect(keyframesRules(sheet.rules)).toEqual([spinRule, pulseRule])
    expect(cache.getAnimations(name)).toEqual([spin, pulse])
    expect(cache.getAnimations(cache.css({ color: 'red' }))).toEqual([])
    expect(cache.getRules(spin)).toEqual([spinRule])
  })

  it('marks the variables of a rule as used, so a pruned theme class declares them', () => {
    const { cache, sheet } = setup({ hasLayers: false })
    const theme = createThemeClass(cache, { '--u-a': 'red', '--u-b': 'blue' })
    cache.css({ animationName: tint })
    expect(sheet.rules).toEqual([tintRule, `.${theme}{--u-a:red;}`, expect.any(String)])
  })

  it('writes a rule now with insertKeyframes, once, and not again for a class', () => {
    const { cache, sheet } = setup()
    cache.insertKeyframes(spin)
    cache.insertKeyframes(spin)
    cache.css({ animationName: spin })
    expect(keyframesRules(sheet.rules)).toEqual([spinRule])
    expect(sheet.rules[0]).toBe(cache.layerOrder)
  })

  it('throws a TypeError from insertKeyframes for a name that keyframes did not return', () => {
    const { cache } = setup()
    expect(() => cache.insertKeyframes('app-own')).toThrow(
      new TypeError(
        'insertKeyframes(): "app-own" is not a name that keyframes() returned, so there is no rule to write.'
      )
    )
  })

  it('resolves steps that are a function of the theme against the theme it is given, and has none of its own', () => {
    const themed = keyframes((theme: { palette: { accent: string } }) => ({
      to: { color: theme.palette.accent },
    }))
    const bare = setup().cache
    expect(() => bare.css({ animationName: themed })).toThrow(
      'keyframes(): these steps are a function of the theme, and this cache has no theme: make the cache through an engine.'
    )
    const { cache, sheet } = setup({ hasLayers: false })
    cache.setKeyframesTheme(() => ({ palette: { accent: 'var(--u-palette-accent)' } }))
    cache.css({ animationName: themed })
    expect(keyframesRules(sheet.rules)).toEqual([
      `@keyframes ${themed}{100%{color:var(--u-palette-accent);}}`,
    ])
  })

  it('is in the extracted css and its ids', () => {
    const { cache } = setup({ hasLayers: false })
    cache.css({ animationName: spin })
    const { css, ids } = cache.extract()
    expect(css).toContain(spinRule)
    expect(ids).toContain(`@keyframes:${spin}`)
  })
})

describe('keyframes and a server render', () => {
  it('are not written again by a cache that starts on a page that has them', () => {
    const server = setup().cache
    server.css({ animation: `${spin} 1s` })
    server.insertKeyframes(pulse)
    document.head.innerHTML = createStyleTag(server)

    const { cache, sheet } = setup()
    cache.css({ animation: `${spin} 1s` })
    cache.insertKeyframes(pulse)
    expect(sheet.rules).toEqual([])
    // A new class that uses a rule the page has writes only the class.
    cache.css({ animationName: pulse, color: 'blue' })
    expect(keyframesRules(sheet.rules)).toEqual([])
    expect(sheet.rules).toHaveLength(1)
  })
})

describe('keyframes in the css of one page', () => {
  function render() {
    const { cache, sheet } = setup({ hasLayers: false })
    const plain = cache.css({ color: 'red' })
    const pulsing = cache.css({ animationName: pulse })
    const both = cache.css({ animation: `${spin} 1s, ${pulse} 2s` })
    return { cache, sheet, plain, pulsing, both }
  }

  it('holds a rule only when a class of the page uses it, once, in the order of the names', () => {
    const { cache, plain, pulsing, both } = render()
    expect(cache.extractPage([plain]).css).toBe(`.${plain}{color:red;}`)
    expect(cache.extractPage([pulsing]).css).toBe(
      `${pulseRule}.${pulsing}{animation-name:${pulse};}`
    )
    const page = cache.extractPage([both, pulsing]).css
    expect(page).toBe(
      inOrder({ [pulse]: pulseRule, [spin]: spinRule }) +
        inOrder({
          [both]: `.${both}{animation:${spin} 1s, ${pulse} 2s;}`,
          [pulsing]: `.${pulsing}{animation-name:${pulse};}`,
        })
    )
    expect(cache.extractPage([pulsing, both]).css).toBe(page)
  })

  it('holds the rules named in animations, written or not, and ignores names it does not know', () => {
    const { cache, sheet, plain } = render()
    const before = [...sheet.rules]
    const { css, ids } = cache.extractPage([plain], { animations: [tint, 'app-own', tint] })
    expect(css).toBe(`${tintRule}.${plain}{color:red;}`)
    expect(ids).toEqual([plain])
    expect(sheet.rules).toEqual(before)
  })

  it('leaves out a rule that the document carries already', () => {
    const { cache, pulsing } = render()
    const { css } = cache.extractPage([pulsing], { carried: new Set([pulse]) })
    expect(css).toBe(`.${pulsing}{animation-name:${pulse};}`)
  })

  it('gives a theme class the variables that a rule of the page refers to', () => {
    const { cache } = setup({ hasLayers: false })
    const theme = createThemeClass(cache, { '--u-a': 'red', '--u-b': 'blue' })
    const tinted = cache.css({ animationName: tint })
    expect(cache.extractPage([theme, tinted]).css).toBe(
      `${tintRule}.${theme}{--u-a:red;}.${tinted}{animation-name:${tint};}`
    )
    expect(cache.extractPage([theme], { animations: [tint] }).css).toBe(
      `${tintRule}.${theme}{--u-a:red;}`
    )
  })

  it('is what extractPageStyles writes, with its animations option', () => {
    const { cache, plain, pulsing } = render()
    const html = `<div class="${plain}"><span class="${pulsing}"></span></div>`
    expect(extractPageStyles(cache, html).css).toBe(
      pulseRule +
        inOrder({
          [plain]: `.${plain}{color:red;}`,
          [pulsing]: `.${pulsing}{animation-name:${pulse};}`,
        })
    )
    expect(extractPageStyles(cache, `<p class="${plain}"></p>`, { animations: [spin] }).css).toBe(
      `${spinRule}.${plain}{color:red;}`
    )
  })
})
