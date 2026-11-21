// Style builders for the benchmarks: the same objects and functions on every run.
import type { WebStyleObject } from '@umber-style/core'

/** A small style object: five plain declarations. */
export function createSmallStyle(): WebStyleObject {
  return {
    display: 'flex',
    padding: 8,
    color: 'red',
    backgroundColor: 'white',
    borderRadius: 4,
  }
}

/**
 * A large style object: more than 50 declarations in all: the base rule, two pseudo selectors, a child
 * selector, two media queries (one with a nested selector in it), a supports query and a motion query.
 */
export function createLargeStyle(): WebStyleObject {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    position: 'relative',
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 0,
    maxWidth: 960,
    margin: '0 auto',
    padding: 16,
    paddingInline: 24,
    border: '1px solid currentColor',
    borderRadius: 8,
    backgroundColor: 'white',
    color: 'black',
    fontFamily: 'system-ui, sans-serif',
    fontSize: 16,
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: '0.01em',
    textAlign: 'left',
    textTransform: 'none',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
    transition: 'color 150ms ease, background-color 150ms ease',
    opacity: 1,
    overflow: 'hidden',
    zIndex: 1,
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: 'lightgray',
      color: 'black',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
      opacity: 0.9,
    },
    '&:focus-visible': {
      outline: '2px solid blue',
      outlineOffset: 2,
    },
    '& > span': {
      display: 'inline-block',
      marginInlineEnd: 4,
      fontWeight: 700,
      textDecoration: 'none',
    },
    '@media (min-width: 40em)': {
      flexDirection: 'row',
      padding: 24,
      maxWidth: 1200,
      fontSize: 18,
      '&:hover': { backgroundColor: 'whitesmoke' },
    },
    '@media (min-width: 64em)': {
      padding: 32,
      fontSize: 20,
      gap: 16,
    },
    '@supports (display: grid)': {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 8,
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  }
}

/** The props of the layout component: the six that its style reads. */
export interface LayoutProps {
  /** The gap between children, in pixels. */
  gap: number
  /** The `flex-direction`. */
  direction: 'row' | 'column'
  /** The `align-items`. */
  align: 'flex-start' | 'center'
  /** The `justify-content`. */
  justify: 'flex-start' | 'space-between'
  /** The `flex-wrap`. */
  wrap: 'nowrap' | 'wrap'
  /** The padding, in pixels. */
  padding: number
}

/** The styles of a layout component that do not depend on its props. */
export const LAYOUT_FIXED = { display: 'flex', minWidth: 0, boxSizing: 'border-box' } as const

/** The prop-driven style of the layout component: a function of `gap`, `direction`, `align`, `justify`, `wrap` and `padding`. */
export function createLayoutStyle(props: LayoutProps): WebStyleObject {
  return {
    gap: props.gap,
    flexDirection: props.direction,
    alignItems: props.align,
    justifyContent: props.justify,
    flexWrap: props.wrap,
    padding: props.padding,
  }
}

const DIRECTIONS = ['row', 'column'] as const
const ALIGNS = ['flex-start', 'center'] as const
const JUSTIFIES = ['flex-start', 'space-between'] as const
const WRAPS = ['nowrap', 'wrap'] as const

/**
 * `count` distinct prop combinations of the layout component, always the same ones in the same order.
 * The four two-way props are counted in binary (16 combinations); each further group of 16 takes the
 * next gap (0, 4, 8, ...), so 48 combinations use the gaps 0, 4 and 8.
 */
export function createCombinations(count: number): LayoutProps[] {
  return Array.from({ length: count }, (_, index) => {
    const gap = 4 * Math.floor(index / 16)
    return {
      gap,
      direction: DIRECTIONS[index & 1],
      align: ALIGNS[(index >> 1) & 1],
      justify: JUSTIFIES[(index >> 2) & 1],
      wrap: WRAPS[(index >> 3) & 1],
      padding: gap * 2,
    }
  })
}

/**
 * A pool of `size` distinct small styles, for a case that needs a style the cache has not seen: each
 * differs from the others in one declaration. Walk it with `createCycle`.
 */
export function createDistinctStyles(size: number, tag = ''): WebStyleObject[] {
  return Array.from({ length: size }, (_, index) => ({
    color: 'red',
    padding: index + 1,
    margin: tag === '' ? 0 : `${index}px ${tag}`,
    '&:hover': { opacity: (index % 10) / 10 },
  }))
}

/**
 * Hands out the items of `pool` in order, and calls `onWrap` each time it comes back to the first: a
 * case that must see fresh input every time uses this with an `onWrap` that makes a fresh cache, so
 * that the cache is made once for each pass over the pool and not once for each operation.
 */
export function createCycle<V>(pool: readonly V[], onWrap: () => void = () => {}): () => V {
  let index = 0
  return () => {
    if (index === pool.length) {
      index = 0
      onWrap()
    }
    return pool[index++]
  }
}
