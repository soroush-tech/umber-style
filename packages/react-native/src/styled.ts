import { createElement, type ElementType } from 'react'
import type { NativeStyleInput, NativeStyleObject } from './nativeStyle'
import { platformStyleSheet } from './platform'
import type { NativeCondition } from './conditions'
import type { WindowState } from './mediaQuery'
import { collectKeys, toNativeStyle, type NativeSettings, type StyleKeys } from './toNativeStyle'
import type { Styled, StyledOptions } from './types'
import { readWindowState, useMediaKey } from './windowState'

type StyleResult = Record<string, never> | null | undefined | false
type StyleFunction = (props: Record<string, unknown>) => StyleResult

/**
 * What one style of a component is: a function, run on each render; an object that is fixed, registered
 * once; one that depends on the window only, registered once for each set of matching queries; or one
 * that depends on the providers, resolved on each render.
 */
type Kind = 'function' | 'fixed' | 'window' | 'conditional'

const NO_KEYS: StyleKeys = { isConditional: false, hasScheme: false, queries: [] }

/** The name a component is known by: its `displayName`, else the name of its function; undefined when it has neither. */
function readComponentName(component: Exclude<ElementType, string>): string | undefined {
  const { displayName, name } = component as { displayName?: string; name?: string }
  return displayName || name || undefined
}

/** `lists` joined, each item once, in order. */
function joinQueries(lists: readonly (readonly string[])[]): string[] {
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
 */
export function createStyled<T>(
  useTheme: () => T,
  useCondition: () => NativeCondition,
  remBase: number
): Styled<T> {
  const styled = (tag: ElementType, options: StyledOptions = {}) => {
    if (typeof tag === 'string') {
      throw new TypeError(`styled needs a component on React Native, not the tag "${tag}".`)
    }
    const { shouldForwardProp: shouldForward } = options
    const settings: NativeSettings = { remBase, name: options.name ?? readComponentName(tag) }

    return (...styles: NativeStyleInput[]) => {
      const keys = styles.map((style) =>
        typeof style === 'function' || !style ? NO_KEYS : (collectKeys(style) ?? NO_KEYS)
      )
      const kinds = styles.map((style, index): Kind => {
        if (typeof style === 'function') return 'function'
        if (keys[index].isConditional) return 'conditional'
        return keys[index].queries.length > 0 ? 'window' : 'fixed'
      })
      // The queries of the object styles come first, so that the key of a render starts with theirs.
      const queries = joinQueries(keys.map((found) => found.queries))
      const hasScheme = keys.some((found) => found.hasScheme)

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

      const render = (
        props: Record<string, unknown>,
        key = '',
        condition?: NativeCondition,
        results?: StyleResult[],
        state?: WindowState
      ) => {
        const resolved = styles.flatMap((style, index) => {
          switch (kinds[index]) {
            case 'fixed':
              return [registered[`s${index}`]]
            case 'window':
              return [readWindowStyles(key)[`s${index}`]]
            case 'conditional':
              return [toNativeStyle(style as Record<string, unknown>, condition, settings, state)]
            default: {
              const result = (results as StyleResult[])[index]
              return result ? [toNativeStyle(result, condition, settings, state)] : []
            }
          }
        })

        const forwarded: Record<string, unknown> = {}
        for (const [name, value] of Object.entries(props)) {
          const isOwn = name === 'as' || name === 'theme' || name === 'style'
          if (!isOwn && (!shouldForward || shouldForward(name))) forwarded[name] = value
        }
        forwarded.style = [...resolved, props.style].flat(Infinity).filter(Boolean)
        return createElement((props.as as ElementType | undefined) ?? tag, forwarded)
      }

      const StaticStyled = (props: Record<string, unknown>) => render(props)
      const WindowStyled = (props: Record<string, unknown>) =>
        render(props, useMediaKey(queries, false, remBase))
      const ConditionalStyled = (props: Record<string, unknown>) => {
        const condition = useCondition()
        const key = useMediaKey(queries, hasScheme && condition.colorScheme === undefined, remBase)
        return render(props, key, condition, undefined, readStateFor(queries))
      }
      const DynamicStyled = (props: Record<string, unknown>) => {
        const theme = useTheme()
        const condition = useCondition()
        // The queries of the function styles are known once they ran; they come after the others.
        const results: StyleResult[] = []
        let found: StyleKeys | undefined
        for (let index = 0; index < styles.length; index++) {
          const style = styles[index]
          if (typeof style !== 'function') continue
          const result = (style as StyleFunction)({ ...props, theme })
          results[index] = result
          if (result) found = collectKeys(result, found)
        }
        const all = found === undefined ? queries : joinQueries([queries, found.queries])
        const shouldWatchScheme =
          (hasScheme || !!found?.hasScheme) && condition.colorScheme === undefined
        const key = useMediaKey(all, shouldWatchScheme, remBase)
        return render(props, key, condition, results, readStateFor(all))
      }
      if (kinds.includes('function')) return DynamicStyled
      if (kinds.includes('conditional')) return ConditionalStyled
      return queries.length > 0 ? WindowStyled : StaticStyled
    }
  }
  return styled as unknown as Styled<T>
}

/** The window now, when there are queries to evaluate. */
function readStateFor(queries: readonly string[]): WindowState | undefined {
  return queries.length > 0 ? readWindowState() : undefined
}
