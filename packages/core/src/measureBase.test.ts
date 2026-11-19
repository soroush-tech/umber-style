import { createCache, createMemorySheet } from './cache'
import { createEngine } from './createEngine'
import type { StyleInput } from './types'

const theme = { space: [0, 4, 8, 16], palette: { primary: '#0000ff' } }
type AppTheme = typeof theme

const gaps = [0, 4, 8]
const directions = ['row', 'column']
const aligns = ['flex-start', 'center']
const justifies = ['flex-start', 'space-between']
const wraps = ['nowrap', 'wrap']

/** The 48 distinct prop combinations of a layout component. */
const combinations = gaps.flatMap((gap) =>
  directions.flatMap((direction) =>
    aligns.flatMap((align) =>
      justifies.flatMap((justify) =>
        wraps.map((wrap) => ({ gap, direction, align, justify, wrap, padding: gap * 2 }))
      )
    )
  )
)

const propsFn = (props: Record<string, unknown>) => ({
  gap: props.gap as number,
  flexDirection: props.direction as 'row',
  alignItems: props.align as string,
  justifyContent: props.justify as string,
  flexWrap: props.wrap as 'wrap',
  padding: props.padding as number,
})

const fixed = { display: 'flex', minWidth: 0, boxSizing: 'border-box' } as const

const variants: Record<string, StyleInput[]> = {
  plainFixed: [fixed, propsFn],
  themeFixed: [
    ({ theme: view }: { theme: AppTheme }) => ({ ...fixed, color: view.palette.primary }),
    propsFn,
  ] as StyleInput[],
}

/** What a layout component writes over 48 combinations, 20 renders each, and the median time of a render. */
function measure(variant: string, hasBaseClass: boolean) {
  const styles = variants[variant]
  const make = () => {
    const sheet = createMemorySheet()
    const cache = createCache({ prefix: 'm', sheet, hasPruning: false, hasBaseClass })
    const engine = createEngine(theme, { prefix: 'm', cache })
    const styler = engine.createStyler({ name: 'Flex' }, styles)
    const view = engine.createThemeView({ ...theme })
    return { cache, styler, view }
  }
  const { cache, styler, view } = make()
  for (let render = 0; render < 20; render++) {
    for (const props of combinations) styler.getClassName(props, undefined, view)
  }
  const rules = cache.extract().css.split('@layer m-components').length - 1
  const { css } = cache.extract()
  const bytes = css.length
  const declarations = css.split(';').length - 2
  const medians: number[] = []
  for (let round = 0; round < 7; round++) {
    const { styler: timed, view: timedView } = make()
    const start = performance.now()
    for (let render = 0; render < 20; render++) {
      for (const props of combinations) timed.getClassName(props, undefined, timedView)
    }
    medians.push(((performance.now() - start) * 1000) / (20 * combinations.length))
  }
  medians.sort((a, b) => a - b)
  return { rules, bytes, declarations, micros: medians[3] }
}

describe('what the base class saves for a layout component', () => {
  it('has 48 distinct combinations', () => {
    expect(combinations).toHaveLength(48)
    expect(new Set(combinations.map((props) => JSON.stringify(props))).size).toBe(48)
  })

  it('writes fewer rules and fewer bytes with fixed styles that are plain objects', () => {
    const off = measure('plainFixed', false)
    const on = measure('plainFixed', true)
    // One rule more (the base), and the fixed declarations are written once, not 48 times.
    expect(off.rules).toBe(48)
    expect(on.rules).toBe(49)
    expect([off.declarations, on.declarations]).toEqual([432, 291])
    expect(on.bytes).toBeLessThan(off.bytes)
    expect(off.micros).toBeGreaterThan(0)
    expect(on.micros).toBeGreaterThan(0)
  })

  it('does the same with fixed styles written as a function of the theme', () => {
    const off = measure('themeFixed', false)
    const on = measure('themeFixed', true)
    expect(off.rules).toBe(48)
    expect(on.rules).toBe(49)
    expect([off.declarations, on.declarations]).toEqual([480, 292])
    expect(on.bytes).toBeLessThan(off.bytes)
  })
})
