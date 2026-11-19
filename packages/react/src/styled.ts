import { createElement, type ElementType } from 'react'
import type { Engine, StyleInput } from '@umber-style/core'
import { prepareStyled } from './styledParts'
import type { Styled, StyledOptions } from './types'

/**
 * Makes `styled` over an engine. A component with a function style reads the theme of the nearest
 * provider through `useThemeView`; one with only object styles reads no context.
 */
export function createStyled<T>(engine: Engine<T>, useThemeView: () => T): Styled<T> {
  const styled =
    (tag: ElementType, options: StyledOptions = {}) =>
    (...styles: StyleInput[]) => {
      const { styler, resolve, statics } = prepareStyled(engine, tag, options, styles)

      const StaticStyled = (props: Record<string, unknown>) => {
        const { element, forwarded } = resolve(props)
        return createElement(element, forwarded)
      }

      const DynamicStyled = (props: Record<string, unknown>) => {
        const { element, forwarded } = resolve(props, useThemeView())
        return createElement(element, forwarded)
      }

      return Object.assign(styler.isDynamic ? DynamicStyled : StaticStyled, statics)
    }
  return styled as unknown as Styled<T>
}
