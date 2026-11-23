// @vitest-environment node
import {
  createCache,
  createEngine,
  createMemorySheet,
  type ClassValue,
  type StyleInput,
} from './index'

/** A style written as the inputs are, past what the style types take (a web part, keys of Object.prototype). */
const raw = (style: object) => style as ClassValue

// The classes, the rules and the CSS of a page for inputs that stress what makes a class cheaper (a hit
// that compiles once, the merges of class names that the cache remembers, the hash, the serializer):
// the same object again, an equal style in a new object, keys in another order, nested rules and
// selector lists, merged classes in both orders and again after one of them is made again, labels,
// layers, a class made after another, values that declare nothing, held classes that leave and come
// back, and a cache shared by two engines with theme views. PINNED is what the cache of 0.3.0 and of
// this branch before the work gave for the same calls (the build of each, run by a script): nothing
// of it may change.

async function runScenario() {
  const out: unknown[] = []
  const sheet = createMemorySheet()
  const cache = createCache({ prefix: 'm', sheet })
  const small = { color: 'red', padding: 8, '&:hover': { opacity: 0.5 } }
  // The same object again, an equal style in a new object, the keys in another order.
  out.push(cache.css(small), cache.css(small), cache.css({ ...small }))
  out.push(cache.css({ padding: 8, color: 'red', '&:hover': { opacity: 0.5 } }))
  // Nested rules: a selector list, a descendant, an at-rule, a nested list inside a list.
  const nested = {
    margin: 0,
    'h1, h2': { margin: 4, '&:hover, &:focus': { color: 'blue' } },
    '@media (min-width: 40em)': { margin: 2, '& > p': { padding: 1 } },
    ':is(a, b) span': { color: 'green' },
    ' &.x ': { color: 'pink' },
  }
  out.push(cache.css(nested), cache.css(nested))
  // Merged classes, in both orders, as one string and as two, again after one of them was made again.
  const a = cache.css({ color: 'red', padding: 1, '&:hover': { opacity: 0.1 } })
  const b = cache.css({ color: 'blue', margin: 2, '&:hover': { opacity: 0.2, color: 'black' } })
  out.push(cache.css(a, b), cache.css(b, a), cache.css(`${a} ${b}`), cache.css(a, b))
  out.push(cache.css({ color: 'red', padding: 1, '&:hover': { opacity: 0.1 } }))
  out.push(cache.css(a, b), cache.css(a, 'foreign', b), cache.css('foreign', a, b))
  out.push(cache.css(a, b, { margin: 9 }), cache.css(a, b, { margin: 9 }))
  // Labels, layers and a class made after another.
  out.push(cache.cssWith({ label: 'Card' }, a, b), cache.cssWith({ label: 'Card' }, a, b))
  out.push(cache.cssIn('overrides', a, b), cache.cssIn('overrides', a, b))
  out.push(
    cache.cssWith({ after: a }, b),
    cache.cssWith({ after: a }, b),
    cache.cssWith({ after: b }, a)
  )
  // A name that is not a class yet, which becomes one: the merge that names it changes.
  out.push(cache.css(a, 'm-later'))
  // A labelled style, and two labelled styles merged.
  const one = cache.css({ label: 'One', color: 'red' })
  const two = cache.css({ label: 'Two', color: 'blue' })
  out.push(one, two, cache.css(one, two), cache.css(two, one), cache.css(one, two))
  // Values that declare nothing, a web part, a list of fallbacks.
  out.push(
    cache.css({ color: undefined, padding: null, margin: false, display: ['block', 'grid'] })
  )
  out.push(cache.css(raw({ web: { color: 'red' }, native: { color: 'blue' }, padding: 2 })))
  out.push(
    cache.css(raw({ color: 'red', web: { color: 'blue' } })),
    cache.css(raw({ color: 'red', web: { color: 'blue' } }))
  )
  out.push(cache.css(raw({ toString: 'x', constructor: 'y', color: 'red' })))
  out.push(cache.css(raw({ 2: 'a', 1: 'b', color: 'red' })))
  out.push(
    cache.css({ userSelect: 'none', display: 'flex' }),
    cache.css({ userSelect: 'none', display: 'flex' })
  )
  out.push({ registered: [...cache.registered.keys()] })
  out.push({ rules: [...sheet.rules] })
  out.push({ extract: cache.extract().css })
  out.push({ page: cache.extractPage([a, b, one, 'm-nothing']).css })

  // Held classes: a held class merged, removed, and made again.
  const heldSheet = createMemorySheet()
  const heldCache = createCache({ prefix: 'h', sheet: heldSheet, hasLayers: false })
  const base = heldCache.css({ color: 'red' })
  const held = heldCache.cssHeld({ layer: 'overrides' }, { width: 4 })
  out.push(held.className, heldCache.css(base, held.className), heldCache.css(base, held.className))
  const release = (held.hold as () => () => void)()
  release()
  await new Promise((resolve) => setTimeout(resolve, 5))
  out.push(heldCache.css(base, held.className), heldCache.css(base, held.className))
  const again = heldCache.cssHeld({ layer: 'overrides' }, { width: 4 })
  out.push(again.className, heldCache.css(base, again.className))
  const merged = heldCache.cssHeld({}, base, { width: 5 })
  out.push(merged.className, heldCache.css(merged.className), heldCache.css(base, merged.className))
  out.push({ heldRules: [...heldSheet.rules], registered: [...heldCache.registered.keys()] })

  // A cache shared by two engines, with theme views and function styles.
  const theme = { palette: { primary: '#1b5fd1', text: '#111111' }, space: [0, 4, 8] }
  const sharedSheet = createMemorySheet()
  const shared = createCache({ prefix: 's', sheet: sharedSheet })
  const first = createEngine(theme, { cache: shared })
  const second = createEngine(
    { ...theme, palette: { primary: '#000000', text: '#ffffff' } },
    { cache: shared }
  )
  const style = (props: { gap?: number; theme: typeof theme }) => ({
    gap: props.gap,
    color: props.theme.palette.primary,
  })
  const fixed = { display: 'flex' }
  const styler1 = first.createStyler({ name: 'Box' }, [fixed, style] as StyleInput[])
  const styler2 = second.createStyler({ name: 'Box' }, [fixed, style] as StyleInput[])
  const view = first.createThemeView(theme)
  const other = first.createThemeView({
    ...theme,
    palette: { primary: '#ff0000', text: '#00ff00' },
  })
  for (const gap of [1, 2, 1, 3, 2]) {
    out.push(
      styler1.getClassName({ gap }, undefined, view),
      styler2.getClassName({ gap }, undefined, undefined)
    )
    out.push(styler1.getClassName({ gap }, undefined, other))
  }
  out.push(
    styler1.getClassName({ gap: 1 }, [{ margin: 1 }], view),
    styler1.getClassName({ gap: 1 }, [{ margin: 1 }], view)
  )
  out.push(first.themeClass(theme), second.themeClass({ palette: { primary: '#123456' } }))
  out.push({ sharedRules: [...sharedSheet.rules] })
  out.push({ sharedPage: shared.extractPage([...shared.registered.keys()]).css })
  return out
}

it('gives the classes, rules and pages it gave before the hit, the merge and the serializer were made cheaper', async () => {
  expect(await runScenario()).toEqual(PINNED)
})

const PINNED = [
  'm-bwn0p5',
  'm-bwn0p5',
  'm-bwn0p5',
  'm-fcuzz6',
  'm-11uxc6w',
  'm-11uxc6w',
  'm-1rkpdt6',
  'm-1183be3',
  'm-1rkpdt6',
  'm-1rkpdt6',
  'm-ymdw3c',
  'm-1rkpdt6',
  'foreign m-1rkpdt6',
  'foreign m-1rkpdt6',
  'm-bufqmm',
  'm-bufqmm',
  'm-Card-1rkpdt6',
  'm-Card-1rkpdt6',
  'm-1uushcc',
  'm-1uushcc',
  'm-150eqz6',
  'm-150eqz6',
  'm-16z5jht',
  'm-later m-ymdw3c',
  'm-One-bkhmwp',
  'm-Two-1vpmm88',
  'm-One-Two-1vpmm88',
  'm-Two-One-bkhmwp',
  'm-One-Two-1vpmm88',
  'm-ku9aw8',
  'm-fbg122',
  'm-1vpmm88',
  'm-1vpmm88',
  'm-1srsdgm',
  'm-pq6f8i',
  'm-mmhstp',
  'm-mmhstp',
  {
    registered: [
      'm-bwn0p5',
      'm-fcuzz6',
      'm-11uxc6w',
      'm-ymdw3c',
      'm-1y9zmkm',
      'm-1rkpdt6',
      'm-1183be3',
      'm-bufqmm',
      'm-Card-1rkpdt6',
      'm-1uushcc',
      'm-150eqz6',
      'm-16z5jht',
      'm-One-bkhmwp',
      'm-Two-1vpmm88',
      'm-One-Two-1vpmm88',
      'm-Two-One-bkhmwp',
      'm-ku9aw8',
      'm-fbg122',
      'm-1vpmm88',
      'm-1srsdgm',
      'm-pq6f8i',
      'm-mmhstp',
    ],
  },
  {
    rules: [
      '@layer m-theme,m-global,m-components,m-overrides;',
      '@layer m-components{.m-bwn0p5{color:red;padding:8px;}}',
      '@layer m-components{.m-bwn0p5:hover{opacity:0.5;}}',
      '@layer m-components{.m-fcuzz6{padding:8px;color:red;}}',
      '@layer m-components{.m-fcuzz6:hover{opacity:0.5;}}',
      '@layer m-components{.m-11uxc6w{margin:0;}}',
      '@layer m-components{.m-11uxc6w h1,.m-11uxc6w h2{margin:4px;}}',
      '@layer m-components{.m-11uxc6w h1:hover,.m-11uxc6w h2:hover,.m-11uxc6w h1:focus,.m-11uxc6w h2:focus{color:blue;}}',
      '@layer m-components{@media (min-width: 40em){.m-11uxc6w{margin:2px;}}}',
      '@layer m-components{@media (min-width: 40em){.m-11uxc6w > p{padding:1px;}}}',
      '@layer m-components{.m-11uxc6w:is(a, b) span{color:green;}}',
      '@layer m-components{.m-11uxc6w.x{color:pink;}}',
      '@layer m-components{.m-ymdw3c{color:red;padding:1px;}}',
      '@layer m-components{.m-ymdw3c:hover{opacity:0.1;}}',
      '@layer m-components{.m-1y9zmkm{color:blue;margin:2px;}}',
      '@layer m-components{.m-1y9zmkm:hover{opacity:0.2;color:black;}}',
      '@layer m-components{.m-1rkpdt6{padding:1px;color:blue;margin:2px;}}',
      '@layer m-components{.m-1rkpdt6:hover{opacity:0.2;color:black;}}',
      '@layer m-components{.m-1183be3{margin:2px;color:red;padding:1px;}}',
      '@layer m-components{.m-1183be3:hover{color:black;opacity:0.1;}}',
      '@layer m-components{.m-bufqmm{padding:1px;color:blue;margin:9px;}}',
      '@layer m-components{.m-bufqmm:hover{opacity:0.2;color:black;}}',
      '@layer m-components{.m-Card-1rkpdt6{padding:1px;color:blue;margin:2px;}}',
      '@layer m-components{.m-Card-1rkpdt6:hover{opacity:0.2;color:black;}}',
      '@layer m-overrides{.m-1uushcc{padding:1px;color:blue;margin:2px;}}',
      '@layer m-overrides{.m-1uushcc:hover{opacity:0.2;color:black;}}',
      '@layer m-components{.m-150eqz6{color:blue;margin:2px;}}',
      '@layer m-components{.m-150eqz6:hover{opacity:0.2;color:black;}}',
      '@layer m-components{.m-16z5jht{color:red;padding:1px;}}',
      '@layer m-components{.m-16z5jht:hover{opacity:0.1;}}',
      '@layer m-components{.m-One-bkhmwp{color:red;}}',
      '@layer m-components{.m-Two-1vpmm88{color:blue;}}',
      '@layer m-components{.m-One-Two-1vpmm88{color:blue;}}',
      '@layer m-components{.m-Two-One-bkhmwp{color:red;}}',
      '@layer m-components{.m-ku9aw8{display:block;display:grid;}}',
      '@layer m-components{.m-fbg122{padding:2px;color:red;}}',
      '@layer m-components{.m-1vpmm88{color:blue;}}',
      '@layer m-components{.m-1srsdgm{to-string:x;constructor:y;color:red;}}',
      '@layer m-components{.m-pq6f8i{1:b;2:a;color:red;}}',
      '@layer m-components{.m-mmhstp{-webkit-user-select:none;user-select:none;display:flex;}}',
    ],
  },
  {
    extract:
      '@layer m-theme,m-global,m-components,m-overrides;@layer m-components{.m-bwn0p5{color:red;padding:8px;}}@layer m-components{.m-bwn0p5:hover{opacity:0.5;}}@layer m-components{.m-fcuzz6{padding:8px;color:red;}}@layer m-components{.m-fcuzz6:hover{opacity:0.5;}}@layer m-components{.m-11uxc6w{margin:0;}}@layer m-components{.m-11uxc6w h1,.m-11uxc6w h2{margin:4px;}}@layer m-components{.m-11uxc6w h1:hover,.m-11uxc6w h2:hover,.m-11uxc6w h1:focus,.m-11uxc6w h2:focus{color:blue;}}@layer m-components{@media (min-width: 40em){.m-11uxc6w{margin:2px;}}}@layer m-components{@media (min-width: 40em){.m-11uxc6w > p{padding:1px;}}}@layer m-components{.m-11uxc6w:is(a, b) span{color:green;}}@layer m-components{.m-11uxc6w.x{color:pink;}}@layer m-components{.m-ymdw3c{color:red;padding:1px;}}@layer m-components{.m-ymdw3c:hover{opacity:0.1;}}@layer m-components{.m-1y9zmkm{color:blue;margin:2px;}}@layer m-components{.m-1y9zmkm:hover{opacity:0.2;color:black;}}@layer m-components{.m-1rkpdt6{padding:1px;color:blue;margin:2px;}}@layer m-components{.m-1rkpdt6:hover{opacity:0.2;color:black;}}@layer m-components{.m-1183be3{margin:2px;color:red;padding:1px;}}@layer m-components{.m-1183be3:hover{color:black;opacity:0.1;}}@layer m-components{.m-bufqmm{padding:1px;color:blue;margin:9px;}}@layer m-components{.m-bufqmm:hover{opacity:0.2;color:black;}}@layer m-components{.m-Card-1rkpdt6{padding:1px;color:blue;margin:2px;}}@layer m-components{.m-Card-1rkpdt6:hover{opacity:0.2;color:black;}}@layer m-overrides{.m-1uushcc{padding:1px;color:blue;margin:2px;}}@layer m-overrides{.m-1uushcc:hover{opacity:0.2;color:black;}}@layer m-components{.m-150eqz6{color:blue;margin:2px;}}@layer m-components{.m-150eqz6:hover{opacity:0.2;color:black;}}@layer m-components{.m-16z5jht{color:red;padding:1px;}}@layer m-components{.m-16z5jht:hover{opacity:0.1;}}@layer m-components{.m-One-bkhmwp{color:red;}}@layer m-components{.m-Two-1vpmm88{color:blue;}}@layer m-components{.m-One-Two-1vpmm88{color:blue;}}@layer m-components{.m-Two-One-bkhmwp{color:red;}}@layer m-components{.m-ku9aw8{display:block;display:grid;}}@layer m-components{.m-fbg122{padding:2px;color:red;}}@layer m-components{.m-1vpmm88{color:blue;}}@layer m-components{.m-1srsdgm{to-string:x;constructor:y;color:red;}}@layer m-components{.m-pq6f8i{1:b;2:a;color:red;}}@layer m-components{.m-mmhstp{-webkit-user-select:none;user-select:none;display:flex;}}',
  },
  {
    page: '@layer m-theme,m-global,m-components,m-overrides;@layer m-components{.m-1y9zmkm{color:blue;margin:2px;}}@layer m-components{.m-1y9zmkm:hover{opacity:0.2;color:black;}}@layer m-components{.m-One-bkhmwp{color:red;}}@layer m-components{.m-ymdw3c{color:red;padding:1px;}}@layer m-components{.m-ymdw3c:hover{opacity:0.1;}}',
  },
  'h-19aazsd',
  'h-1mi8thn',
  'h-1mi8thn',
  'h-19aazsd h-bkhmwp',
  'h-19aazsd h-bkhmwp',
  'h-19aazsd',
  'h-1mi8thn',
  'h-fuah2d',
  'h-fuah2d',
  'h-fuah2d',
  {
    heldRules: [
      '.h-bkhmwp{color:red;}',
      '.h-1mi8thn{color:red;width:4px;}',
      '.h-19aazsd{width:4px;}',
      '.h-fuah2d{color:red;width:5px;}',
    ],
    registered: ['h-bkhmwp', 'h-1mi8thn', 'h-19aazsd', 'h-fuah2d'],
  },
  's-box-root-1kb7boq s-box-root-do32rx',
  's-box-root-1kb7boq s-box-root-do32rx',
  's-box-root-1kb7boq s-box-root-do32rx',
  's-box-root-1kb7boq s-box-root-1xrq02d',
  's-box-root-1kb7boq s-box-root-1xrq02d',
  's-box-root-1kb7boq s-box-root-1xrq02d',
  's-box-root-1kb7boq s-box-root-do32rx',
  's-box-root-1kb7boq s-box-root-do32rx',
  's-box-root-1kb7boq s-box-root-do32rx',
  's-box-root-1kb7boq s-box-root-1grordr',
  's-box-root-1kb7boq s-box-root-1grordr',
  's-box-root-1kb7boq s-box-root-1grordr',
  's-box-root-1kb7boq s-box-root-1xrq02d',
  's-box-root-1kb7boq s-box-root-1xrq02d',
  's-box-root-1kb7boq s-box-root-1xrq02d',
  's-box-root-1kb7boq s-box-root-do32rx s-box-root-o0bvyu',
  's-box-root-1kb7boq s-box-root-do32rx s-box-root-o0bvyu',
  's-theme-ocoodk s-boundary',
  's-theme-1npzyn8 s-boundary',
  {
    sharedRules: [
      '@layer s-theme,s-global,s-components,s-overrides;',
      '@layer s-components{.s-box-root-1kb7boq{display:flex;}}',
      '@layer s-components{.s-box-root-do32rx{gap:1px;color:var(--s-palette-primary);}}',
      '@layer s-components{.s-box-root-1xrq02d{gap:2px;color:var(--s-palette-primary);}}',
      '@layer s-components{.s-box-root-1grordr{gap:3px;color:var(--s-palette-primary);}}',
      '@layer s-overrides{.s-box-root-o0bvyu{margin:1px;}}',
      '@layer s-theme{.s-theme-ocoodk{--s-palette-primary:#1b5fd1;}}',
      '@layer s-theme{.s-theme-1npzyn8{--s-palette-primary:#123456;}}',
    ],
  },
  {
    sharedPage:
      '@layer s-theme,s-global,s-components,s-overrides;@layer s-components{.s-box-root-1kb7boq{display:flex;}}@layer s-components{.s-box-root-1grordr{gap:3px;color:var(--s-palette-primary);}}@layer s-components{.s-box-root-1xrq02d{gap:2px;color:var(--s-palette-primary);}}@layer s-components{.s-box-root-do32rx{gap:1px;color:var(--s-palette-primary);}}@layer s-overrides{.s-box-root-o0bvyu{margin:1px;}}',
  },
]

it('gives the same classes past the number of merges it remembers, made again for the oldest', () => {
  const run = (isTwice: boolean) => {
    const sheet = createMemorySheet()
    const cache = createCache({ prefix: 'n', sheet })
    const classes = Array.from({ length: 1200 }, (_, index) => cache.css({ width: index }))
    const merged = classes.map((name, index) => cache.css(name, classes[(index + 1) % 1200]))
    const again = isTwice
      ? classes.map((name, index) => cache.css(name, classes[(index + 1) % 1200]))
      : merged
    return { merged, again, rules: sheet.rules.length }
  }
  const once = run(false)
  const twice = run(true)
  expect(twice.merged).toEqual(once.merged)
  expect(twice.again).toEqual(once.merged)
  expect(twice.rules).toBe(once.rules)
})
