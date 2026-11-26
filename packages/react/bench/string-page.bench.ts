// What one operation is, in this file: the server render of one page shaped like a design system's,
// with the client build of the binding and production React, over a cache that a render before the
// measurement made warm. The page is a provider of a theme of 148 tokens and six raw keys, a `Global` given a
// function of the theme that returns a `css` template, and 104 elements of 52 distinct components (each
// a function of the theme and a function of its props; every fourth one styled from the one before it),
// each component twice with other props.
//   new theme each render   the provider is given `{ ...theme }` in every render, as an app whose own
//                           provider makes its theme in the render does; "same theme" gives it the one
//                           object.
//   repair                  the engine is made as `configure({ prefix, hasValueRepair: true, rawKeys })`
//                           makes it: no base theme given, the first provider's theme adopted. "No
//                           repair" is the same with `hasValueRepair: false`.
//   base theme and another  the engine is given the theme as its base (`configure({ theme })`), and the
//   provider theme          provider a dark theme of the same shape, the one object or a new one each
//                           render: the theme below the provider is the dark one merged over the base.
//   style elements          `renderToString`, which sends the style elements of each class in the HTML.
//   extracted               the render under a `CacheProvider` (no style element), then the CSS of the
//                           page with `createInstance(cache)` of `@umber-style/server`: its chunks and
//                           their style tags, the instance made in each operation.
// Each case has an engine, a cache and a prefix of its own, with an in-memory sheet.
import type { BenchConfig } from '@soroush.tech/bench'
import type * as Core from '@umber-style/core'
import { createRequire } from 'node:module'
import type * as React from 'react'
import type * as Cache from '../../cache/src/index'
import type * as Server from '../../server/src/createInstance'
import type { WebStyle } from '../src/types'
import { binding, renderToString } from './client'

const load = createRequire(import.meta.url)
const core = load('../../core/dist/index.cjs') as typeof Core
const { createCache } = load('../../cache/dist/index.cjs') as typeof Cache
const { createInstance } = load('../../server/dist/createInstance.cjs') as typeof Server
const h = (load('react') as typeof React).createElement

const COLORS = [
  'primary',
  'secondary',
  'success',
  'warning',
  'danger',
  'info',
  'neutral',
  'accent',
  'grey',
]
const SHADES = ['lighter', 'light', 'main', 'dark']

/** A colour from an index: the same index always gives the same colour. */
const toColor = (index: number) =>
  `#${((index * 2654435761) % 0x1000000).toString(16).padStart(6, '0')}`

type Scale = Record<string, string>

/** The theme of the page: about 150 tokens and six raw keys. */
interface PageTheme {
  name: string
  colorScheme: string
  palette: Record<string, Scale>
  background: Scale
  text: Scale
  border: Scale
  space: number[]
  fontSizes: number[]
  lineHeights: Record<string, number>
  fontWeights: Record<string, number>
  letterSpacings: Scale
  fonts: Scale
  radii: Record<string, number>
  borderWidths: Record<string, number>
  zOrder: Record<string, number>
  shadows: string[]
  opacity: Record<string, number>
  blur: string
  avatar: Scale
  icon: Scale
  misc: Scale
  breakpoints: Record<string, number>
  sizes: Record<string, number>
  typography: Record<string, { fontSize: string; fontWeight: number; lineHeight: number }>
  layout: Record<string, number>
  transitions: Scale
  components: Record<string, Record<string, number>>
}

/** `make` of each key, as a record. */
const record = <V>(keys: readonly string[], make: (key: string) => V): Record<string, V> =>
  Object.fromEntries(keys.map((key) => [key, make(key)]))

/** The theme of the page, the same on every run. */
function createPageTheme(): PageTheme {
  let next = 0
  const color = () => toColor(next++)
  return {
    name: 'page',
    colorScheme: 'light',
    palette: record(COLORS, () => record(SHADES, color)),
    background: record(['default', 'paper', 'subtle', 'inverse', 'overlay', 'muted'], color),
    text: record(['primary', 'secondary', 'disabled', 'inverse', 'link', 'muted'], color),
    border: record(['default', 'strong', 'subtle', 'focus'], color),
    space: [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
    fontSizes: [12, 14, 16, 20, 24, 32, 48],
    lineHeights: record(['tight', 'normal', 'relaxed', 'loose'], (key) => key.length / 4),
    fontWeights: record(['light', 'regular', 'medium', 'bold', 'black'], (key) => key.length * 100),
    letterSpacings: record(['tight', 'normal', 'wide', 'wider'], (key) => `${key.length / 100}em`),
    fonts: record(['body', 'heading', 'mono'], (key) => `${key}, system-ui, sans-serif`),
    radii: record(['none', 'sm', 'md', 'lg', 'xl', 'full'], (key) => key.length * 2),
    borderWidths: record(['thin', 'medium', 'thick'], (key) => key.length - 3),
    zOrder: record(
      ['base', 'dropdown', 'sticky', 'modal', 'toast', 'tooltip'],
      (key) => key.length
    ),
    shadows: Array.from({ length: 25 }, (_, index) => `0 ${index}px ${index * 2}px #00000066`),
    opacity: record(['disabled', 'hover', 'focus', 'selected'], (key) => key.length / 10),
    blur: '12px',
    avatar: record(['sm', 'md', 'lg', 'xl'], (key) => `${key.length * 16}px`),
    icon: record(['sm', 'md', 'lg', 'xl'], (key) => `${key.length * 12}px`),
    misc: record(['filter', 'blend', 'outline', 'ring', 'gap', 'gutter'], (key) => `${key}-value`),
    // Raw keys: real values, no variable.
    breakpoints: { sm: 600, md: 900, lg: 1200, xl: 1536 },
    sizes: record(['xs', 'sm', 'md', 'lg', 'xl', 'full'], (key) => key.length * 120),
    typography: record(['h1', 'h2', 'h3', 'body', 'caption', 'label'], (key) => ({
      fontSize: `${key.length + 12}px`,
      fontWeight: key.length * 200,
      lineHeight: 1.4,
    })),
    layout: { container: 1200, gutter: 24, header: 64, sidebar: 280 },
    transitions: { fast: '120ms ease-out', normal: '200ms ease-out', slow: '320ms ease-in-out' },
    components: { button: { minWidth: 64 }, input: { height: 40 } },
  }
}

const theme = createPageTheme()

/** The theme of the provider where the engine has another base theme: the same shape, other colours. */
const darkTheme: PageTheme = {
  ...theme,
  colorScheme: 'dark',
  palette: Object.fromEntries(
    Object.entries(theme.palette).map(([key], index) => [
      key,
      record(SHADES, (shade) => toColor(1000 + index * 10 + SHADES.indexOf(shade))),
    ])
  ),
  background: record(Object.keys(theme.background), (key) => toColor(2000 + key.length)),
  text: record(Object.keys(theme.text), (key) => toColor(3000 + key.length)),
}

const RAW_KEYS = ['breakpoints', 'components', 'transitions', 'sizes', 'typography', 'layout']
const COMPONENTS = 52
const VARIANTS = ['solid', 'outline', 'ghost'] as const

/** The props of every component of the page. */
interface PartProps {
  variant: (typeof VARIANTS)[number]
  size: number
}

/** The 52 components over `style`: a function of the theme, then one of the props; every fourth from the one before. */
function createParts(style: WebStyle<PageTheme>) {
  const parts: React.ComponentType<PartProps>[] = []
  for (let index = 0; index < COMPONENTS; index++) {
    const color = COLORS[index % COLORS.length]
    const element = index % 2 === 0 ? 'div' : 'span'
    const tag = index % 4 === 3 ? (parts[index - 1] as never) : element
    const part = style.styled(tag as 'div', {
      name: `Part${index}`,
      shouldForwardProp: (prop) => prop !== 'variant' && prop !== 'size',
    })<PartProps>(
      ({ theme: { palette, space, radii, fontSizes, fonts, typography, breakpoints } }) => ({
        display: 'flex',
        color: palette[color].main,
        padding: `${space[(index % 6) + 1]} ${space[(index % 4) + 2]}`,
        borderRadius: radii.md,
        fontFamily: fonts.body,
        fontSize: fontSizes[index % 7],
        lineHeight: typography.body.lineHeight,
        '&:hover': { backgroundColor: palette[color].light },
        ...binding.at(`@media (min-width: ${breakpoints.md}px)`, {
          padding: space[(index % 8) + 3],
        }),
      }),
      ({ variant, size, theme: { palette, border } }) => ({
        borderColor: variant === 'outline' ? palette[color].dark : border.default,
        backgroundColor: variant === 'solid' ? palette[color].main : 'transparent',
        minHeight: size * 8,
        marginTop: `calc(${size} * 2px)`,
      })
    )
    parts.push(part as unknown as React.ComponentType<PartProps>)
  }
  return parts
}

/** The styles of the page's `Global`: a function of the theme that returns a `css` template. */
function createGlobalStyles(style: WebStyle<PageTheme>) {
  return ({ text, background, fonts, fontSizes, lineHeights, palette }: PageTheme) => style.css`
    html,
    body {
      margin: 0;
      color: ${text.primary};
      background-color: ${background.default};
      font-family: ${fonts.body};
      line-height: ${lineHeights.normal};
    }
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }
    h1 {
      font-size: ${fontSizes[5]};
    }
    a {
      color: ${palette.primary.main};
    }
  `
}

/** How one case renders its page. */
interface CaseOptions {
  /** Whether the provider is given a new object in each render (`{ ...theme }`). */
  isNewTheme: boolean
  hasValueRepair: boolean
  /** Whether the page is rendered under a `CacheProvider` and its CSS extracted, rather than sent as style elements. */
  isExtracted?: boolean
  /** Whether the engine is given the theme as its base (`configure({ theme })`) and the provider another one. */
  hasBase?: boolean
}

/** One case: a style of its own (prefix, engine, cache), its page, and the operation. */
function prepare(
  prefix: string,
  { isNewTheme, hasValueRepair, isExtracted = false, hasBase = false }: CaseOptions
) {
  const engine = core.createLazyEngine<PageTheme>({
    prefix,
    hasValueRepair,
    rawKeys: RAW_KEYS,
    cache: core.createCache({ prefix, sheet: core.createMemorySheet(), hasDevChecks: false }),
  })
  if (hasBase) engine.setTheme(theme)
  const given = hasBase ? darkTheme : theme
  const style = binding.bindEngine(engine)
  const parts = createParts(style)
  const globalStyles = createGlobalStyles(style)
  const content = parts.flatMap((Part, index) =>
    [0, 1].map((second) =>
      h(Part, {
        key: `${index}-${second}`,
        variant: VARIANTS[(index + second) % VARIANTS.length],
        size: (index % 5) + second + 1,
      })
    )
  )
  // The provider of the app: it makes its theme in each render, or gives the one object.
  const Page = () =>
    h(
      style.ThemeProvider,
      { theme: isNewTheme ? { ...given } : given },
      h(style.Global, { styles: globalStyles }),
      ...content
    )
  const page = h(Page)
  const pageCache = createCache({ key: prefix })
  const provided = h(binding.CacheProvider, { value: pageCache }, page)
  const run = isExtracted
    ? () => {
        const html = renderToString(provided)
        const instance = createInstance(pageCache)
        return html + instance.constructStyleTagsFromChunks(instance.extractCriticalToChunks(html))
      }
    : () => renderToString(page)
  run()
  return run
}

export default {
  name: 'react: a page shaped like a design system',
  cases: {
    'new theme each render, repair, style elements': prepare('pa', {
      isNewTheme: true,
      hasValueRepair: true,
    }),
    'same theme, repair, style elements': prepare('pb', {
      isNewTheme: false,
      hasValueRepair: true,
    }),
    'new theme each render, no repair, style elements': prepare('pc', {
      isNewTheme: true,
      hasValueRepair: false,
    }),
    'same theme, no repair, style elements': prepare('pd', {
      isNewTheme: false,
      hasValueRepair: false,
    }),
    'new theme each render, repair, extracted': prepare('pe', {
      isNewTheme: true,
      hasValueRepair: true,
      isExtracted: true,
    }),
    'same theme, repair, extracted': prepare('pf', {
      isNewTheme: false,
      hasValueRepair: true,
      isExtracted: true,
    }),
    'base theme and another provider theme, repair, style elements': prepare('pg', {
      isNewTheme: false,
      hasValueRepair: true,
      hasBase: true,
    }),
    'base theme and another provider theme each render, repair, style elements': prepare('ph', {
      isNewTheme: true,
      hasValueRepair: true,
      hasBase: true,
    }),
  },
} satisfies BenchConfig
