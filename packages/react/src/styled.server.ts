import { createElement, Fragment, type ElementType } from 'react'
import { readStyleArguments, withTagShorthands, type Engine } from '@umber-style/core'
import { createStyleElements } from './styleElements'
import { prepareStyled } from './styledParts'
import type { Styled, StyledOptions } from './types'

/**
 * Makes `styled` for server components: no hook, no context. A function style reads the view of the
 * theme that `readTheme` gives: the base theme (tokens as references, its real values for the rest), else
 * the theme of the first provider of the request, else an empty theme. Each element comes with the `<style>` of its class.
 */
export function createStyled<T>(engine: Engine<T>, readTheme: () => T): Styled<T> {
  const styled =
    (tag: ElementType, options: StyledOptions = {}) =>
    (...args: unknown[]) => {
      // Called with styles, or as a tag: a template is one style.
      const styles = readStyleArguments(args)
      const { styler, resolve, statics } = prepareStyled(engine, tag, options, styles)

      const Styled = (props: Record<string, unknown>) => {
        const theme = styler.isDynamic ? engine.createThemeView(readTheme()) : undefined
        const { element, forwarded, className } = resolve(props, theme)
        return createElement(
          Fragment,
          null,
          ...createStyleElements(engine.cache, className),
          createElement(element, forwarded)
        )
      }

      return Object.assign(Styled, statics)
    }
  return withTagShorthands(styled) as unknown as Styled<T>
}
