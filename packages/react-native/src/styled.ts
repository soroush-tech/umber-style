import { createElement, type ElementType } from 'react'
import type { NativeStyleInput } from './nativeStyle'
import { platformStyleSheet } from './platform'
import type { NativeCondition } from './conditions'
import { hasConditions, toNativeStyle, type NativeSettings } from './toNativeStyle'
import type { Styled, StyledOptions } from './types'

type StyleFunction = (
  props: Record<string, unknown>
) => Record<string, never> | null | undefined | false

/** The name a component is known by: its `displayName`, else the name of its function; undefined when it has neither. */
function readComponentName(component: Exclude<ElementType, string>): string | undefined {
  const { displayName, name } = component as { displayName?: string; name?: string }
  return displayName || name || undefined
}

/**
 * Makes `styled` for React Native. Its object styles are registered with the platform StyleSheet
 * once, when the component is made; its function styles are computed with the real theme, which
 * `useTheme` reads, on each render. A style with a `when()` or `whenScheme()` key is resolved on each
 * render against the nearest provider, which `useCondition` reads; it is not registered. A component
 * without function styles or condition keys reads no context. A `rem` length is `remBase` times its
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
      const isDynamic = styles.some((style) => typeof style === 'function')
      const isConditional = styles.some(
        (style) => typeof style !== 'function' && !!style && hasConditions(style)
      )
      const fixed = Object.fromEntries(
        styles.flatMap((style, index) =>
          typeof style === 'function' || !style || hasConditions(style)
            ? []
            : [[`s${index}`, toNativeStyle(style, undefined, settings)]]
        )
      )
      const registered = Object.keys(fixed).length > 0 ? platformStyleSheet.create(fixed) : fixed

      const render = (props: Record<string, unknown>, theme?: T, condition?: NativeCondition) => {
        const resolved = styles.flatMap((style, index) => {
          if (typeof style !== 'function') {
            return [
              style && hasConditions(style)
                ? toNativeStyle(style, condition, settings)
                : registered[`s${index}`],
            ]
          }
          const result = (style as StyleFunction)({ ...props, theme })
          return result ? [toNativeStyle(result, condition, settings)] : []
        })

        const forwarded: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(props)) {
          const isOwn = key === 'as' || key === 'theme' || key === 'style'
          if (!isOwn && (!shouldForward || shouldForward(key))) forwarded[key] = value
        }
        forwarded.style = [...resolved, props.style].flat(Infinity).filter(Boolean)
        return createElement((props.as as ElementType | undefined) ?? tag, forwarded)
      }

      const StaticStyled = (props: Record<string, unknown>) => render(props)
      const DynamicStyled = (props: Record<string, unknown>) =>
        render(props, useTheme(), useCondition())
      const ConditionalStyled = (props: Record<string, unknown>) =>
        render(props, undefined, useCondition())
      if (isDynamic) return DynamicStyled
      return isConditional ? ConditionalStyled : StaticStyled
    }
  }
  return styled as unknown as Styled<T>
}
