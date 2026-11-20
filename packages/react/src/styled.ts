import {
  createElement,
  Fragment,
  useInsertionEffect,
  type ElementType,
  type ReactElement,
} from 'react'
import { readStyleArguments, withTagShorthands, type Engine } from '@umber-style/core'
import { prepareStyled } from './styledParts'
import type { Styled, StyledOptions } from './types'

interface HoldProps {
  /** The `hold` of the class: the same function while the class lives, another for another class. */
  hold: () => () => void
}

/**
 * Counts the element next to it as a user of its held class, from the commit that shows the class to the
 * commit that drops it or the unmount. An insertion effect runs in the commit, before the browser paints:
 * a render that is thrown away holds nothing, and the class, which render wrote, is still in the sheet.
 */
function Hold({ hold }: HoldProps): null {
  useInsertionEffect(() => hold(), [hold])
  return null
}

/**
 * Makes `styled` over an engine. A component with a function style reads the theme of the nearest
 * provider through `useThemeView`; one with only object styles reads no context. `createStyleElements`
 * gives the style elements of a class where the build sends them (a server render), and none in the browser.
 * In the browser, an element given a plain object in `style` holds the class that object made (`Hold`,
 * rendered after it only then), so that the class is removed when no element uses it.
 */
export function createStyled<T>(
  engine: Engine<T>,
  useThemeView: () => T,
  createStyleElements: (className: string) => ReactElement[]
): Styled<T> {
  /** The element, with the style elements of its class in front of it where there are any, and its `Hold` after it where it holds a class. */
  const render = (
    element: ElementType,
    forwarded: Record<string, unknown>,
    className: string,
    hold: (() => () => void) | undefined
  ) => {
    const rendered = createElement(element, forwarded)
    if (hold) return createElement(Fragment, null, rendered, createElement(Hold, { hold }))
    const styles = createStyleElements(className)
    return styles.length === 0 ? rendered : createElement(Fragment, null, ...styles, rendered)
  }
  // Only the browser has a lifecycle that can let a class go; a server render keeps every class.
  const canHold = () => typeof document !== 'undefined'

  const styled =
    (tag: ElementType, options: StyledOptions = {}) =>
    (...args: unknown[]) => {
      // Called with styles, or as a tag: a template is one style.
      const styles = readStyleArguments(args)
      const { styler, resolve, statics } = prepareStyled(engine, tag, options, styles)

      const StaticStyled = (props: Record<string, unknown>) => {
        const { element, forwarded, className, hold } = resolve(props, undefined, canHold())
        return render(element, forwarded, className, hold)
      }

      const DynamicStyled = (props: Record<string, unknown>) => {
        const { element, forwarded, className, hold } = resolve(props, useThemeView(), canHold())
        return render(element, forwarded, className, hold)
      }

      return Object.assign(styler.isDynamic ? DynamicStyled : StaticStyled, statics)
    }
  return withTagShorthands(styled) as unknown as Styled<T>
}
