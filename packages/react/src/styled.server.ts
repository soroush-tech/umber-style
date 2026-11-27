import { createElement, Fragment, type ElementType } from 'react'
import { isDevelopment, type Engine } from '@umber-style/core'
import { EMPTY_THEME, readStyleArguments, withTagShorthands } from '@umber-style/core/internal'
import type { StyleSender } from './inlineStyles.server'
import { withNonce, type RequestNonce } from './serverContext'
import { collectStyleTexts } from './styleElements'
import { prepareStyled } from './styledParts'
import type { Styled, StyledOptions } from './types'

/** The name of a component in a message: its label, its name, or the tag it renders. */
function readComponentName(tag: ElementType, { label, name }: StyledOptions): string {
  if (label ?? name) return (label ?? name) as string
  if (typeof tag === 'string') return tag
  return tag.displayName ?? tag.name
}

/**
 * Makes `styled` for server components: no hook, no context. A function style reads the view of the
 * theme that `readTheme` gives: the base theme (tokens as references, its real values for the rest), else
 * the theme of the first provider of the request, else an empty theme. Each element comes with the style
 * of its class, which `sendStyles` makes with the nonce of the request that `readNonce` gives.
 */
export function createStyled<T>(
  engine: Engine<T>,
  readTheme: () => T,
  readNonce: () => RequestNonce,
  sendStyles: StyleSender
): Styled<T> {
  const styled =
    (tag: ElementType, options: StyledOptions = {}) =>
    (...args: unknown[]) => {
      // Called with styles, or as a tag: a template is one style.
      const styles = readStyleArguments(args)
      const { styler, resolve, statics } = prepareStyled(engine, tag, options, styles)

      // With no base theme and no provider yet, a style function would read an empty theme: said once for
      // the component, in development, before the function runs.
      let hasWarned = false
      const readViewTheme = (): T => {
        const real = readTheme()
        if (real === EMPTY_THEME && !hasWarned && isDevelopment()) {
          hasWarned = true
          console.warn(
            `[${engine.cache.prefix}] A style function of "${readComponentName(tag, options)}" runs in a server component with no base theme, so it reads an empty theme and a token it reads is undefined. Give the theme before the first styled call, to createStyle(theme) or configure({ theme }), or with getEngine().setTheme(theme) when it is known only later.`
          )
        }
        return real
      }

      const Styled = (props: Record<string, unknown>) => {
        const theme = styler.isDynamic ? engine.createThemeView(readViewTheme()) : undefined
        const { element, forwarded, className } = resolve(props, theme)
        // The nonce of the request: at once once it is known, else this component waits for it.
        return withNonce(readNonce(), (nonce) =>
          createElement(
            Fragment,
            null,
            ...sendStyles(collectStyleTexts(engine.cache, className), nonce),
            createElement(element, forwarded)
          )
        )
      }

      return Object.assign(Styled, statics)
    }
  return withTagShorthands(styled) as unknown as Styled<T>
}
