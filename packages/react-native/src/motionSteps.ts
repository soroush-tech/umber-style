import type { KeyframesSteps } from '@umber-style/core'
import { readTransform } from './motionText'
import { isMotionKey, toNativeStyle } from './toNativeStyle'
import { warnAboutMotion } from './warnStyle'

/** The steps of an animation as the animation library takes them: by offset (`'0%'` to `'100%'`), each a native style. */
export type LibrarySteps = Record<string, Record<string, unknown>>

/**
 * The style properties that the animation library animates on React Native: the keys of its
 * `STYLE_PROPERTIES_CONFIG` (`src/common/style/config.ts` of react-native-reanimated 4.8.0) that it does
 * not set to `false`. Its props builder drops every other key of a step without a word
 * (`src/common/style/createPropsBuilder.ts`, 89-95). `shadowOffset`, `shadowOpacity` and `shadowRadius`
 * are not animated on Android, and `elevation` and `overlayColor` only there.
 */
export const ANIMATED_KEYS: ReadonlySet<string> = new Set([
  'flex',
  'flexBasis',
  'flexDirection',
  'justifyContent',
  'alignItems',
  'alignSelf',
  'alignContent',
  'flexGrow',
  'flexShrink',
  'flexWrap',
  'gap',
  'rowGap',
  'columnGap',
  'start',
  'end',
  'direction',
  'height',
  'width',
  'maxHeight',
  'maxWidth',
  'minHeight',
  'minWidth',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'marginStart',
  'marginEnd',
  'marginBlock',
  'marginBlockEnd',
  'marginBlockStart',
  'marginInline',
  'marginInlineEnd',
  'marginInlineStart',
  'marginHorizontal',
  'marginVertical',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'paddingStart',
  'paddingEnd',
  'paddingBlock',
  'paddingBlockEnd',
  'paddingBlockStart',
  'paddingInline',
  'paddingInlineEnd',
  'paddingInlineStart',
  'paddingHorizontal',
  'paddingVertical',
  'top',
  'left',
  'bottom',
  'right',
  'inset',
  'insetBlock',
  'insetInline',
  'insetBlockStart',
  'insetBlockEnd',
  'insetInlineStart',
  'insetInlineEnd',
  'position',
  'display',
  'overflow',
  'zIndex',
  'aspectRatio',
  'backgroundColor',
  'color',
  'textDecorationColor',
  'textShadowColor',
  'borderColor',
  'borderTopColor',
  'borderBlockStartColor',
  'borderRightColor',
  'borderEndColor',
  'borderBottomColor',
  'borderBlockEndColor',
  'borderLeftColor',
  'borderStartColor',
  'borderBlockColor',
  'outlineColor',
  'shadowColor',
  'overlayColor',
  'tintColor',
  'shadowOffset',
  'shadowOpacity',
  'shadowRadius',
  'elevation',
  'textShadowOffset',
  'textShadowRadius',
  'boxShadow',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopStartRadius',
  'borderStartStartRadius',
  'borderTopRightRadius',
  'borderTopEndRadius',
  'borderStartEndRadius',
  'borderBottomLeftRadius',
  'borderBottomStartRadius',
  'borderEndStartRadius',
  'borderBottomRightRadius',
  'borderBottomEndRadius',
  'borderEndEndRadius',
  'borderWidth',
  'borderTopWidth',
  'borderStartWidth',
  'borderBottomWidth',
  'borderEndWidth',
  'borderLeftWidth',
  'borderRightWidth',
  'borderCurve',
  'borderStyle',
  'outlineOffset',
  'outlineStyle',
  'outlineWidth',
  'transformOrigin',
  'transform',
  'backfaceVisibility',
  'opacity',
  'mixBlendMode',
  'backgroundImage',
  'experimental_backgroundImage',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'textAlign',
  'textAlignVertical',
  'verticalAlign',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'textDecorationLine',
  'textDecorationStyle',
  'userSelect',
  'writingDirection',
  'includeFontPadding',
  'resizeMode',
  'objectFit',
  'cursor',
  'pointerEvents',
  'filter',
  'isolation',
])

/** What translating the steps of one animation needs. */
export interface StepSettings {
  /** The font size that `1rem` is. */
  readonly remBase: number
  /** The component the style belongs to, for the development warnings. */
  readonly name: string | undefined
  /** The easing of a step (`animationTimingFunction`) as the library takes it; undefined for text it cannot read. */
  readonly readEasing: (value: unknown) => unknown
}

/** The offset of one part of a step key, as the library and this file key a step: `from` is `'0%'`, `to` is `'100%'`. */
function toOffset(part: string): string {
  if (part === 'from') return '0%'
  if (part === 'to') return '100%'
  return `${Number.parseFloat(part)}%`
}

/**
 * Checks, in place, a transform written as text in the step `offset`: `none` becomes no transform, and text
 * the library would reject is dropped with a development warning (4.7 of the library throws for it).
 */
function checkTransform(native: Record<string, unknown>, offset: string, name: string | undefined) {
  const { transform } = native
  if (typeof transform !== 'string') return
  const read = readTransform(transform)
  if (read !== undefined) {
    native.transform = read
    return
  }
  warnAboutMotion(
    `"transform: ${transform}" in the step "${offset}" is not a transform the animation library reads; it is dropped from the step. Write translate, scale, rotate, skew, matrix or perspective, with lengths in px or %, and angles in deg or rad.`,
    name
  )
  delete native.transform
}

/** One step as the library takes it: a native style of the keys it animates, and the easing of the step. */
function translateStep(
  step: Record<string, unknown>,
  offset: string,
  settings: StepSettings
): Record<string, unknown> {
  const { remBase, name, readEasing } = settings
  const own: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(step)) {
    if (!isMotionKey(key)) own[key] = value
    else if (key !== 'animationTimingFunction') {
      warnAboutMotion(
        `"${key}" in the step "${offset}" is ignored, as the web ignores it in a step.`,
        name
      )
    }
  }
  const native: Record<string, unknown> = toNativeStyle(own, undefined, { remBase, name })
  for (const key of Object.keys(native)) {
    if (ANIMATED_KEYS.has(key)) continue
    warnAboutMotion(
      `"${key}" in the step "${offset}" is not animated by the animation library on React Native; it is dropped from the step.`,
      name
    )
    delete native[key]
  }
  checkTransform(native, offset, name)
  const easing = step.animationTimingFunction
  if (easing === undefined) return native
  const read = readEasing(easing)
  if (read !== undefined) native.animationTimingFunction = read
  return native
}

/**
 * The steps of an animation, as `keyframes` was given them, in the form the library takes: each key split
 * at its commas and named by its offset, each step turned into a native style as a style is (lengths in
 * `px` and `rem` are numbers, web-only keys dropped), the keys the library does not animate dropped with a
 * development warning, and the steps of one offset merged with the later winning.
 */
export function translateSteps(steps: KeyframesSteps, settings: StepSettings): LibrarySteps {
  const translated: LibrarySteps = {}
  for (const [key, step] of Object.entries(steps)) {
    for (const part of key.split(',')) {
      const offset = toOffset(part.trim())
      const native = translateStep(step as Record<string, unknown>, offset, settings)
      translated[offset] = { ...translated[offset], ...native }
    }
  }
  return translated
}

/** The item at `index` of a longhand that may be a list, a short list repeated as CSS repeats it; a value that is no list is every item. */
function pickItem(value: unknown, index: number): unknown {
  return Array.isArray(value) ? value[index % value.length] : value
}

/**
 * The offset an animation ends on: `'100%'` or `'0%'`, from its count and direction; undefined for one
 * that never ends (`infinite`) or ends between two cycles (a count that is not whole).
 */
export function findEndOffset(count: unknown, direction: unknown): string | undefined {
  if (typeof count !== 'number' || !Number.isInteger(count)) return undefined
  const isReversed = direction === 'reverse' || direction === 'alternate-reverse'
  if (count === 0) return isReversed ? '100%' : '0%'
  const isLastFlipped = String(direction).startsWith('alternate') && count % 2 === 0
  return isReversed === isLastFlipped ? '100%' : '0%'
}

/**
 * What the finite animations of `style` that fill forwards leave on the view when they end: the step each
 * ends on, merged in the order of the animations, without its easing. `readSteps` gives the steps of a
 * rule of the library.
 */
export function readEndStyle(
  style: Record<string, unknown>,
  readSteps: (rule: unknown) => LibrarySteps | undefined
): Record<string, unknown> {
  const { animationName, animationFillMode, animationIterationCount, animationDirection } = style
  const rules = Array.isArray(animationName) ? animationName : [animationName]
  const end: Record<string, unknown> = {}
  rules.forEach((rule, index) => {
    const fill = pickItem(animationFillMode, index)
    if (fill !== 'forwards' && fill !== 'both') return
    const count = pickItem(animationIterationCount, index) ?? 1
    const offset = findEndOffset(count, pickItem(animationDirection, index) ?? 'normal')
    const step = offset === undefined ? undefined : readSteps(rule)?.[offset]
    if (step === undefined) return
    const { animationTimingFunction: _easing, ...values } = step
    Object.assign(end, values)
  })
  return end
}
