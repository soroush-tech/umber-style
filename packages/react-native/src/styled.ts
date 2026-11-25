import { createElement, type ElementType } from 'react'
import type { StateName } from '@umber-style/core'
import type { InteractionState, NativeCondition } from './conditions'
import {
  createHeldHandlers,
  isHeldName,
  isStateProp,
  readInteraction,
  useHeldStates,
  type HeldName,
  type HeldStates,
} from './interaction'
import type { NativeStyleInput, NativeStyleObject } from './nativeStyle'
import { platformPressable, platformStyleSheet } from './platform'
import type { WindowState } from './mediaQuery'
import {
  collectKeys,
  hasMotion,
  toNativeStyle,
  type NativeSettings,
  type StyleKeys,
} from './toNativeStyle'
import type { Motion, Styled, StyledOptions } from './types'
import { warnAboutLateMotion, warnAboutUnheldState } from './warnStyle'
import { readReducedMotion, readWindowState, useMediaKey } from './windowState'

type StyleResult = Record<string, never> | null | undefined | false
type StyleFunction = (props: Record<string, unknown>) => StyleResult

/** What `Pressable` gives a `style` that is a function. */
interface PressState {
  pressed: boolean
}

/** A `style` prop that is a function, as `Pressable` takes one. */
type OwnStyle = (press: PressState) => unknown

/**
 * What one style of a component is: a function, run on each render; an object that is fixed, registered
 * once; one that depends on the window only, registered once for each set of matching queries; or one
 * that depends on the providers or on what the component is doing, resolved on each render.
 */
type Kind = 'function' | 'fixed' | 'window' | 'conditional'

const NO_KEYS: StyleKeys = { isConditional: false, hasScheme: false, queries: [], states: [] }

/** The states, in the order of the part of the key of a resolved style that says which of them hold. */
const STATE_ORDER: readonly StateName[] = ['hovered', 'pressed', 'focused', 'disabled']

/** The name a component is known by: its `displayName`, else the name of its function; undefined when it has neither. */
function readComponentName(component: Exclude<ElementType, string>): string | undefined {
  const { displayName, name } = component as { displayName?: string; name?: string }
  return displayName || name || undefined
}

/** Whether the style `style` has an animation or transition key, where `motion` runs them. */
function isMovingStyle(style: unknown, motion: Motion | undefined): boolean {
  return motion !== undefined && typeof style === 'object' && !!style && hasMotion(style as never)
}

/** `lists` joined, each item once, in order. */
function joinItems<T>(lists: readonly (readonly T[])[]): T[] {
  return [...new Set(lists.flat())]
}

/**
 * Makes `styled` for React Native. Its object styles are registered with the platform StyleSheet
 * once, when the component is made; its function styles are computed with the real theme, which
 * `useTheme` reads, on each render. A style with a `when()` or `whenScheme()` key is resolved on each
 * render against the nearest provider, which `useCondition` reads; it is not registered. An object style
 * with media query keys and no condition key is resolved and registered once for each set of matching
 * queries. A component renders again when the set of its matching queries changes (or the system color
 * scheme, for a `whenScheme()` key that no provider decides); one without function styles, condition
 * keys or media keys reads no context and subscribes to nothing. A `rem` length is `remBase` times its
 * number. The development warnings name the component: its `name` option, else the wrapped component's.
 *
 * A style with a `state()` key is resolved on each render too, against what the component is doing: a
 * `Pressable` that names `pressed` gets `style` as a function of its `{ pressed }`, so that it renders
 * again on a press; `disabled` follows the props; `hovered` and `focused` are kept from the component's
 * events when its object styles name them, and follow the props of those names otherwise.
 *
 * With `motion` (the `animated` option), a component whose styles have an animation or transition key
 * renders the animated form of its component that `motion` makes, and its styles keep those keys,
 * translated. Whether it animates is known from its object styles when it is made, or from a function
 * style the first time one returns such a key; from then on the component stays animated. A component
 * that animates renders again when the system's reduced motion changes, and is given `motion.reduce` of
 * its styles while it is on; one whose object styles name `pressed` keeps the press as state, so that
 * its `style` stays a list the library reads.
 */
export function createStyled<T>(
  useTheme: () => T,
  useCondition: () => NativeCondition,
  remBase: number,
  motion?: Motion
): Styled<T> {
  const styled = (tag: ElementType, options: StyledOptions = {}) => {
    if (typeof tag === 'string') {
      throw new TypeError(`styled needs a component on React Native, not the tag "${tag}".`)
    }
    const { shouldForwardProp: shouldForward } = options
    const settings: NativeSettings = {
      remBase,
      name: options.name ?? readComponentName(tag),
      motion,
    }

    /** Whether the prop `name` reaches the element; with `hasStates` the props that tell a state are the binding's unless `shouldForwardProp` asks for them. */
    const isForwarded = (name: string, hasStates: boolean): boolean => {
      if (hasStates && isStateProp(name)) return shouldForward?.(name) === true
      const isOwn = name === 'as' || name === 'theme' || name === 'style'
      return !isOwn && (!shouldForward || shouldForward(name))
    }

    return (...styles: NativeStyleInput[]) => {
      const keys = styles.map((style) =>
        typeof style === 'function' || !style ? NO_KEYS : (collectKeys(style) ?? NO_KEYS)
      )
      const kinds = styles.map((style, index): Kind => {
        if (typeof style === 'function') return 'function'
        const { isConditional, states: own, queries: ownQueries } = keys[index]
        if (isConditional || own.length > 0) return 'conditional'
        return ownQueries.length > 0 ? 'window' : 'fixed'
      })
      // The queries of the object styles come first, so that the key of a render starts with theirs.
      const queries = joinItems(keys.map((found) => found.queries))
      const hasScheme = keys.some((found) => found.hasScheme)
      // The states of the object styles; hover and focus among them are kept from the component's events.
      const states = joinItems(keys.map((found) => found.states))
      // Whether the object styles animate: then the component renders the animated form of its component.
      const isAnimated = styles.some((style) => isMovingStyle(style, motion))
      // A component that animates keeps its press too, so that its style is a list and not a function.
      const heldNames: HeldName[] = states.filter(isHeldName)
      if (isAnimated && states.includes('pressed')) heldNames.push('pressed')
      // Whether it renders the animated form: from the start, or from the first function style that animates.
      let isWrapped = isAnimated

      /** The object styles of `kind`, resolved for `state` and registered with the platform. */
      const register = (kind: Kind, state?: WindowState): Record<string, NativeStyleObject> => {
        const pairs = styles.flatMap((style, index) =>
          kinds[index] === kind && style
            ? [
                [
                  `s${index}`,
                  toNativeStyle(style as Record<string, unknown>, undefined, settings, state),
                ],
              ]
            : []
        )
        return pairs.length > 0 ? platformStyleSheet.create(Object.fromEntries(pairs)) : {}
      }
      const registered = register('fixed')
      const byWindow = new Map<string, Record<string, NativeStyleObject>>()

      /** The styles that depend on the window only, for the key of a render: registered once for each set of matching queries. */
      const readWindowStyles = (key: string) => {
        const windowKey = key.slice(0, queries.length)
        let found = byWindow.get(windowKey)
        if (found === undefined) {
          found = register('window', readWindowState())
          byWindow.set(windowKey, found)
        }
        return found
      }

      // The conditional object styles as they were resolved, by the theme of the condition (held weakly),
      // then by the rest of what resolving them reads (see `readResolved`).
      const resolvedByTheme = new WeakMap<object, Map<string, NativeStyleObject>>()
      const resolvedWithoutTheme = new Map<string, NativeStyleObject>()

      /**
       * The object style at `index`, which has condition or state keys, resolved for the render: made once
       * for each theme of the condition, color scheme of the provider, key of the window (the queries that
       * match, and the system color scheme where it is read) and set of states, and the same object after.
       * The style is fixed when the component is made, as the fixed styles are, and what resolves it reads
       * nothing else, so the resolved style is the same.
       */
      const readResolved = (
        index: number,
        key: string,
        condition: NativeCondition,
        state: WindowState | undefined,
        interaction: InteractionState | undefined
      ): NativeStyleObject => {
        const { theme, colorScheme = '' } = condition
        let found = theme === undefined ? resolvedWithoutTheme : resolvedByTheme.get(theme)
        if (found === undefined) {
          found = new Map()
          resolvedByTheme.set(theme as object, found)
        }
        const states = STATE_ORDER.map((name) => (interaction?.[name] === true ? '1' : '0')).join(
          ''
        )
        const cacheKey = `${index}|${key}|${colorScheme}|${states}`
        let resolved = found.get(cacheKey)
        if (resolved === undefined) {
          const style = styles[index] as Record<string, unknown>
          resolved = toNativeStyle(style, condition, settings, state, interaction)
          found.set(cacheKey, resolved)
        }
        return resolved
      }

      /** The styles of a render, in order, for the key of the render, the providers, the window and what the component is doing. */
      const resolve = (
        key: string,
        condition: NativeCondition | undefined,
        results: StyleResult[] | undefined,
        state: WindowState | undefined,
        interaction?: InteractionState
      ) =>
        styles.flatMap((_style, index) => {
          switch (kinds[index]) {
            case 'fixed':
              return [registered[`s${index}`]]
            case 'window':
              return [readWindowStyles(key)[`s${index}`]]
            case 'conditional':
              // A conditional style is rendered by a component that reads the condition: there is one.
              return [readResolved(index, key, condition as NativeCondition, state, interaction)]
            default: {
              const result = (results as StyleResult[])[index]
              return result ? [toNativeStyle(result, condition, settings, state, interaction)] : []
            }
          }
        })

      /** `list` as the component is given it: for reduced motion when it animates and the system asks for less. */
      const finishList = (list: unknown[]) =>
        isWrapped && readReducedMotion()
          ? list.map((entry) => (motion as Motion).reduce(entry as NativeStyleObject))
          : list

      /**
       * The `style` of a component whose styles name `used`: for a `Pressable` that names `pressed` (or
       * is given a function `style`) and does not animate, a function of what it reports, so that it
       * renders again on a press; else the list for what the props and `held` say. A `style` prop that is
       * a function is called with the same `{ pressed }`, and its result comes last.
       */
      const createStateStyle = (
        props: Record<string, unknown>,
        used: readonly StateName[],
        styleOf: (interaction: InteractionState) => NativeStyleObject[],
        held: HeldStates | undefined
      ) => {
        const base = readInteraction(props, held?.states)
        const own = props.style
        const build = (interaction: InteractionState, press: PressState) =>
          finishList(
            [...styleOf(interaction), typeof own === 'function' ? (own as OwnStyle)(press) : own]
              .flat(Infinity)
              .filter(Boolean)
          )
        const component = (props.as as ElementType | undefined) ?? tag
        // The animated component reads a list: an animated Pressable is told its press by `held`.
        const isPressDriven =
          !isWrapped &&
          component === platformPressable &&
          (used.includes('pressed') || typeof own === 'function')
        if (!isPressDriven) return build(base, { pressed: base.pressed === true })
        return ({ pressed }: PressState) =>
          build({ ...base, pressed: pressed || base.pressed === true }, { pressed })
      }

      const render = (
        props: Record<string, unknown>,
        key = '',
        condition?: NativeCondition,
        results?: StyleResult[],
        state?: WindowState,
        found?: StyleKeys,
        held?: HeldStates
      ) => {
        // The states of the function styles are known once they ran; they come after the others.
        const used = found === undefined ? states : joinItems([states, found.states])
        const hasStates = used.length > 0
        const forwarded: Record<string, unknown> = {}
        for (const [name, value] of Object.entries(props)) {
          if (isForwarded(name, hasStates)) forwarded[name] = value
        }
        const own = (props.as as ElementType | undefined) ?? tag
        const component = isWrapped ? (motion as Motion).wrap(own) : own
        if (!hasStates) {
          forwarded.style = finishList(
            [...resolve(key, condition, results, state), props.style].flat(Infinity).filter(Boolean)
          )
          return createElement(component, forwarded)
        }
        for (const name of used) {
          if (isHeldName(name) && !heldNames.includes(name))
            warnAboutUnheldState(name, settings.name)
        }
        const styleOf = (interaction: InteractionState) =>
          resolve(key, condition, results, state, interaction)
        forwarded.style = createStateStyle(props, used, styleOf, held)
        if (held) Object.assign(forwarded, createHeldHandlers(heldNames, props, held))
        return createElement(component, forwarded)
      }

      const StaticStyled = (props: Record<string, unknown>) => render(props)
      const WindowStyled = (props: Record<string, unknown>) =>
        render(props, useMediaKey(queries, false, remBase, isAnimated))
      const useConditionalElement = (props: Record<string, unknown>, held?: HeldStates) => {
        const condition = useCondition()
        const shouldWatchScheme = hasScheme && condition.colorScheme === undefined
        const key = useMediaKey(queries, shouldWatchScheme, remBase, isAnimated)
        return render(props, key, condition, undefined, readStateFor(queries), undefined, held)
      }
      const useDynamicElement = (props: Record<string, unknown>, held?: HeldStates) => {
        const theme = useTheme()
        const condition = useCondition()
        // The queries of the function styles are known once they ran; they come after the others.
        const results: StyleResult[] = []
        let found: StyleKeys | undefined
        let isMoving = isAnimated
        for (let index = 0; index < styles.length; index++) {
          const style = styles[index]
          if (typeof style !== 'function') continue
          const result = (style as StyleFunction)({ ...props, theme })
          results[index] = result
          if (result) found = collectKeys(result, found)
          isMoving ||= isMovingStyle(result, motion)
        }
        if (isMoving && !isWrapped) {
          isWrapped = true
          warnAboutLateMotion(settings.name)
        }
        const all = found === undefined ? queries : joinItems([queries, found.queries])
        const shouldWatchScheme =
          (hasScheme || !!found?.hasScheme) && condition.colorScheme === undefined
        // The same hook in every render: what it watches follows what the styles of this render name.
        const key = useMediaKey(all, shouldWatchScheme, remBase, isMoving)
        return render(props, key, condition, results, readStateFor(all), found, held)
      }
      const ConditionalStyled = (props: Record<string, unknown>) => useConditionalElement(props)
      const DynamicStyled = (props: Record<string, unknown>) => useDynamicElement(props)
      const hasFunction = kinds.includes('function')
      if (heldNames.length > 0) {
        // Hover and focus are kept as state: one hook more, in every render of this component.
        const useElement = hasFunction ? useDynamicElement : useConditionalElement
        const HeldStyled = (props: Record<string, unknown>) => useElement(props, useHeldStates())
        return HeldStyled
      }
      if (hasFunction) return DynamicStyled
      if (kinds.includes('conditional')) return ConditionalStyled
      return queries.length > 0 || isAnimated ? WindowStyled : StaticStyled
    }
  }
  return styled as unknown as Styled<T>
}

/** The window now, when there are queries to evaluate. */
function readStateFor(queries: readonly string[]): WindowState | undefined {
  return queries.length > 0 ? readWindowState() : undefined
}
