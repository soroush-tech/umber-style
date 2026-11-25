import type { ElementType } from 'react'
import { readKeyframesSteps, type KeyframesSteps } from '@umber-style/core'
import type { NativeStyleObject } from './nativeStyle'
import {
  BEHAVIORS,
  DIRECTIONS,
  expandAnimation,
  expandTransition,
  FILL_MODES,
  PLAY_STATES,
  type Expansion,
} from './motionShorthand'
import { readEndStyle, translateSteps, type LibrarySteps } from './motionSteps'
import {
  readCssNumber,
  readEasing,
  readTime,
  splitList,
  toCamelCase,
  type EasingReading,
} from './motionText'
import { isMotionKey } from './toNativeStyle'
import type { AnimatedDriver, Motion, MotionContext } from './types'
import { warnAboutMotion } from './warnStyle'

/** A position of `steps()`, as the animation library names it. */
type StepsPosition = 'jump-start' | 'jump-end' | 'jump-none' | 'jump-both' | 'start' | 'end'

/** What the entry takes from the animation library: the functions of its public API that it calls. */
export interface AnimationLibrary {
  /** `createAnimatedComponent`: the animated form of a component, which runs the CSS animations and transitions of its style. */
  readonly createAnimatedComponent: (component: never) => unknown
  /** `css.keyframes`: a keyframes rule of steps, compared by identity when a view's style changes. */
  readonly keyframes: (steps: LibrarySteps) => object
  /** `cubicBezier`: the easing object of a curve. */
  readonly cubicBezier: (x1: number, y1: number, x2: number, y2: number) => object
  /** `steps`: the easing object of steps. */
  readonly steps: (count: number, position: StepsPosition) => object
}

/** How many keys and values one styling remembers what they set before it forgets them all. */
const MAX_READ_KEYS = 1000

/** An item of a longhand read: its value as the library takes it, or `undefined` when it is not valid. */
type ReadItem = (item: unknown) => unknown

/** What the development warning adds after the value of each longhand that is not valid. */
const HINTS: Readonly<Record<string, string>> = {
  animationName: 'a name that keyframes returned, or none',
  animationDuration: 'a time of 0 or more, such as 1.5s or 300ms',
  animationTimingFunction: 'a named easing, cubic-bezier(x1, y1, x2, y2) or steps(count, position)',
  animationDelay: 'a time, such as 1.5s or 300ms',
  animationIterationCount: 'a number of 0 or more, or infinite',
  animationDirection: 'normal, reverse, alternate or alternate-reverse',
  animationFillMode: 'none, forwards, backwards or both',
  animationPlayState: 'running or paused',
  transitionProperty: 'all, none (alone), or style properties',
  transitionDuration: 'a time of 0 or more, such as 1.5s or 300ms',
  transitionTimingFunction:
    'a named easing, cubic-bezier(x1, y1, x2, y2) or steps(count, position)',
  transitionDelay: 'a time, such as 1.5s or 300ms',
  transitionBehavior: 'normal or allow-discrete',
}

/** The items of a longhand: a list as it is, text cut at its commas, anything else alone. */
function readItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  return typeof value === 'string' ? splitList(value) : [value]
}

/** A keyword of `keywords`, in any case, in its lower case; undefined for anything else. */
function readKeyword(item: unknown, keywords: ReadonlySet<string>): string | undefined {
  if (typeof item !== 'string') return undefined
  const lower = item.toLowerCase()
  return keywords.has(lower) ? lower : undefined
}

/** A count of cycles: `'infinite'`, or a number of 0 or more written as a number or as text. */
function readCount(item: unknown): unknown {
  if (typeof item === 'string' && item.toLowerCase() === 'infinite') return 'infinite'
  const count = typeof item === 'string' ? readCssNumber(item) : item
  return typeof count === 'number' && count >= 0 ? count : undefined
}

/** A duration: a time of 0 or more, in milliseconds. */
function readDuration(item: unknown): number | undefined {
  const time = readTime(item)
  return time !== undefined && time >= 0 ? time : undefined
}

/** A property that transitions, as the platform names it: `all`, `none` or a style key. */
function readProperty(item: unknown): string | undefined {
  return typeof item === 'string' ? toCamelCase(item) : undefined
}

/**
 * Makes the `animated` value of the entry over `library`: each styling binds it to its base of `rem` and
 * its base theme, and the animated form of a component is made once for the program.
 */
export function createAnimatedDriver(library: AnimationLibrary): AnimatedDriver {
  const wrapped = new WeakMap<object, ElementType>()
  const wrap = (component: ElementType): ElementType => {
    let found = wrapped.get(component as object)
    if (found === undefined) {
      found = library.createAnimatedComponent(component as never) as ElementType
      wrapped.set(component as object, found)
    }
    return found
  }

  /** An easing read as the library takes it: a name as it is, a curve or steps as its easing object. */
  const toLibraryEasing = (reading: EasingReading): unknown => {
    if (reading.kind === 'named') return reading.name
    if (reading.kind === 'steps') {
      return library.steps(reading.count, reading.position as StepsPosition)
    }
    return library.cubicBezier(...reading.points)
  }

  /** An easing item: text read and made into the library's form; an object (an easing of the library) as it is. */
  const readEasingItem: ReadItem = (item) => {
    if (typeof item === 'object' && item !== null) return item
    const reading = typeof item === 'string' ? readEasing(item) : undefined
    return reading === undefined ? undefined : toLibraryEasing(reading)
  }

  // The steps of each rule the library made, for what a finished animation leaves when motion is reduced.
  const stepsByRule = new WeakMap<object, LibrarySteps>()

  return {
    bind({ remBase, readTheme }: MotionContext): Motion {
      // One rule for each name, so that the library meets the same rule each time a style names it; the
      // rules of steps that are a function of the theme are kept for each theme object.
      const rules = new Map<string, object>()
      const themedRules = new WeakMap<object, Map<string, object>>()
      const reduced = new WeakMap<object, NativeStyleObject>()

      /** The rule of the registered `name`, made once (for each base theme when its steps are a function of it). */
      const readRule = (name: string, styleName: string | undefined): object => {
        const input = readKeyframesSteps(name)
        const isThemed = typeof input === 'function'
        const theme = isThemed ? readTheme() : undefined
        let byName = rules
        if (theme !== undefined) {
          byName = themedRules.get(theme) ?? new Map()
          themedRules.set(theme, byName)
        }
        let rule = byName.get(name)
        if (rule === undefined) {
          const steps = isThemed ? input(theme) : input
          const settings = { remBase, name: styleName, readEasing: readEasingItem }
          const translated = translateSteps(steps as KeyframesSteps, settings)
          rule = library.keyframes(translated)
          stepsByRule.set(rule, translated)
          byName.set(name, rule)
        }
        return rule
      }

      /** The names of `value`: each a rule of the library, `none` left out, `'none'` when none is left. */
      const readNames = (value: unknown, styleName: string | undefined): unknown => {
        const items = readItems(value)
        const isItem = (item: unknown) =>
          typeof item === 'string' || (typeof item === 'object' && !!item)
        if (!items.every(isItem)) return undefined
        const found = items.flatMap((item) => {
          if (typeof item !== 'string') return [item]
          if (item === 'none') return []
          if (readKeyframesSteps(item) !== undefined) return [readRule(item, styleName)]
          warnAboutMotion(
            `"animationName: ${item}" is not a name that keyframes returned, so no animation runs for it. Give the name keyframes returns.`,
            styleName
          )
          return []
        })
        if (found.length === 0) return 'none'
        return found.length === 1 ? found[0] : found
      }

      /** The readers of the longhands; `animationName` is read by `readNames`. */
      const READERS: Readonly<Record<string, ReadItem>> = {
        animationDuration: readDuration,
        animationTimingFunction: readEasingItem,
        animationDelay: readTime,
        animationIterationCount: readCount,
        animationDirection: (item) => readKeyword(item, DIRECTIONS),
        animationFillMode: (item) => readKeyword(item, FILL_MODES),
        animationPlayState: (item) => readKeyword(item, PLAY_STATES),
        transitionProperty: readProperty,
        transitionDuration: readDuration,
        transitionTimingFunction: readEasingItem,
        transitionDelay: readTime,
        transitionBehavior: (item) => readKeyword(item, BEHAVIORS),
      }

      /** The value of the longhand `key` as the library takes it; undefined when an item of it is not valid. */
      const readLonghand = (key: string, value: unknown, styleName: string | undefined) => {
        if (key === 'animationName') return readNames(value, styleName)
        const items = readItems(value).map(READERS[key])
        if (items.includes(undefined)) return undefined
        if (key === 'transitionProperty' && items.length > 1 && items.includes('none')) {
          return undefined
        }
        return items.length === 1 ? items[0] : items
      }

      /** Sets the longhand `key` of `style` to `value` read, or keeps what it had, with a warning, when `value` is not valid. */
      const setLonghand = (
        style: Record<string, unknown>,
        key: string,
        value: unknown,
        styleName: string | undefined
      ) => {
        if (!(key in HINTS)) {
          warnAboutMotion(
            `"${key}" is not run by the animation library on React Native; it is dropped.`,
            styleName
          )
          return
        }
        const read = readLonghand(key, value, styleName)
        if (read !== undefined) {
          style[key] = read
          return
        }
        warnAboutMotion(
          `"${key}: ${String(value)}" is not valid: it is dropped, as the web drops it. Write ${HINTS[key]}.`,
          styleName
        )
      }

      /** Sets each longhand of a shorthand, or warns that the shorthand is dropped. */
      const setShorthand = (
        style: Record<string, unknown>,
        key: string,
        expansion: Expansion,
        styleName: string | undefined
      ) => {
        if ('problem' in expansion) {
          warnAboutMotion(
            `"${key}" cannot read "${expansion.problem}": the whole ${key} is dropped, as the web drops it.`,
            styleName
          )
          return
        }
        for (const [longhand, value] of Object.entries(expansion.longhands)) {
          setLonghand(style, longhand, value, styleName)
        }
      }

      /** What the key `key: value` of a style sets: its longhands as the library takes them, the invalid ones left out. */
      const readKey = (key: string, value: unknown, styleName: string | undefined) => {
        const keys: Record<string, unknown> = {}
        if (typeof value !== 'string' && (key === 'animation' || key === 'transition')) {
          setShorthand(keys, key, { problem: String(value) }, styleName)
        } else if (key === 'animation') {
          const isName = (word: string) => readKeyframesSteps(word) !== undefined
          setShorthand(keys, key, expandAnimation(value as string, isName), styleName)
        } else if (key === 'transition') {
          setShorthand(keys, key, expandTransition(value as string), styleName)
        } else setLonghand(keys, key, value, styleName)
        return keys
      }

      // What each key and value written as text or a number sets, for each base theme (the steps of a
      // name may be a function of it) and component: a function style gives the same text on every
      // render, and reading it again is most of the cost of a translation.
      const readKeysByTheme = new WeakMap<object, Map<string, Readonly<Record<string, unknown>>>>()

      /** `readKey`, remembered for a value that is text or a number (at most `MAX_READ_KEYS`, then forgotten together). */
      const readKeyOnce = (key: string, value: unknown, styleName: string | undefined) => {
        const isText = typeof value === 'string' || typeof value === 'number'
        if (!isText) return readKey(key, value, styleName)
        const theme = readTheme()
        const readKeys = readKeysByTheme.get(theme) ?? new Map()
        readKeysByTheme.set(theme, readKeys)
        const id = `${styleName ?? ''}\u0000${key}\u0000${typeof value}:${value}`
        let keys = readKeys.get(id)
        if (keys === undefined) {
          if (readKeys.size >= MAX_READ_KEYS) readKeys.clear()
          keys = readKey(key, value, styleName)
          readKeys.set(id, keys)
        }
        return keys
      }

      const translate = (style: Record<string, unknown>, styleName: string | undefined) => {
        if (!Object.keys(style).some(isMotionKey)) return
        // In the order written, so that a later key wins over an earlier one, as in a rule of the web.
        const entries = Object.entries(style)
        for (const [key] of entries) delete style[key]
        for (const [key, value] of entries) {
          if (isMotionKey(key)) Object.assign(style, readKeyOnce(key, value, styleName))
          else style[key] = value
        }
      }

      const reduce = (style: NativeStyleObject): NativeStyleObject => {
        if (typeof style !== 'object' || style === null) return style
        const found = reduced.get(style)
        if (found !== undefined) return found
        const own = style as Record<string, unknown>
        let result: NativeStyleObject = style
        if (Object.keys(own).some(isMotionKey)) {
          const still = Object.fromEntries(Object.entries(own).filter(([key]) => !isMotionKey(key)))
          const end = readEndStyle(own, (rule) => stepsByRule.get(rule as object))
          result = { ...still, ...end } as NativeStyleObject
        }
        reduced.set(style, result)
        return result
      }

      return { translate, reduce, wrap }
    },
  }
}
