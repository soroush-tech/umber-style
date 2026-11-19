import { createElement, Fragment, type ElementType, type ReactElement } from 'react'
import type { Engine, StyleInput } from '@umber-style/core'
import { prepareStyled } from './styledParts'
import type { Styled, StyledOptions } from './types'

/**
 * Makes `styled` over an engine. A component with a function style reads the theme of the nearest
 * provider through `useThemeView`; one with only object styles reads no context. `createStyleElements`
 * gives the style elements of a class where the build sends them (a server render), and none in the browser.
 */
export function createStyled<T>(
  engine: Engine<T>,
  useThemeView: () => T,
  createStyleElements: (className: string) => ReactElement[]
): Styled<T> {
  /** The element, with the style elements of its class in front of it where there are any. */
  const render = (element: ElementType, forwarded: Record<string, unknown>, className: string) => {
    const styles = createStyleElements(className)
    const rendered = createElement(element, forwarded)
    return styles.length === 0 ? rendered : createElement(Fragment, null, ...styles, rendered)
  }

  const styled =
    (tag: ElementType, options: StyledOptions = {}) =>
    (...styles: StyleInput[]) => {
      const { styler, resolve, statics } = prepareStyled(engine, tag, options, styles)

      const StaticStyled = (props: Record<string, unknown>) => {
        const { element, forwarded, className } = resolve(props)
        return render(element, forwarded, className)
      }

      const DynamicStyled = (props: Record<string, unknown>) => {
        const { element, forwarded, className } = resolve(props, useThemeView())
        return render(element, forwarded, className)
      }

      return Object.assign(styler.isDynamic ? DynamicStyled : StaticStyled, statics)
    }
  return styled as unknown as Styled<T>
}
