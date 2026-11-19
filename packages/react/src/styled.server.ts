import { createElement, Fragment, type ElementType } from 'react'
import type { Engine, StyleInput } from '@umber-style/core'
import { createStyleElements } from './styleElements'
import { prepareStyled } from './styledParts'
import type { Styled, StyledOptions } from './types'

/**
 * Makes `styled` for server components: no hook, no context. A function style reads the view of the
 * theme that `readTheme` gives, which is the root theme of the request. Each element comes with the
 * `<style>` of its class.
 */
export function createStyled<T>(engine: Engine<T>, readTheme: () => T): Styled<T> {
  const styled =
    (tag: ElementType, options: StyledOptions = {}) =>
    (...styles: StyleInput[]) => {
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
  return styled as unknown as Styled<T>
}
