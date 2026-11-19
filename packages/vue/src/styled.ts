import { h, normalizeClass, type Component } from 'vue'
import { flattenStyle, type Engine, type StyleInput } from '@umber-style/core'
import type { Styled, StyledComponent, StyledOptions, StyledStatics } from './types'

/** Whether `tag` is a component made by `styled`. */
function isStyledComponent(tag: string | Component): tag is StyledComponent {
  return typeof tag === 'function' && '_styles' in tag
}

/**
 * Makes `styled` over an engine: a functional component that renders the tag with one class. A
 * function style gets the view of the theme of the nearest provider, which `useThemeView` reads.
 */
export function createStyled<T>(engine: Engine<T>, useThemeView: () => T): Styled<T> {
  return (tag: string | Component, options: StyledOptions = {}) =>
    (...styles: StyleInput[]) => {
      const inner = isStyledComponent(tag) ? tag : undefined
      const baseTag = inner?._tag ?? tag
      const shouldForward = options.shouldForwardProp ?? inner?._shouldForwardProp
      const styler = engine.createStyler(options, styles, inner?._styles)

      const Styled: StyledComponent = Object.assign(
        (
          _props: Record<string, unknown>,
          { attrs, slots }: Pick<Parameters<StyledComponent>[1], 'attrs' | 'slots'>
        ) => {
          // Everything in the style attribute, entries and plain objects, joins the one class, after
          // the styles. No style attribute is ever rendered; a string is an error.
          const className = styler.getClassName(
            attrs,
            [...flattenStyle(attrs.style, engine.cache.findEntry), normalizeClass(attrs.class)],
            styler.isDynamic ? useThemeView() : undefined
          )
          const element = (attrs.as as string | Component | undefined) ?? baseTag
          const filter = typeof element === 'string' ? shouldForward : undefined

          const forwarded: Record<string, unknown> = {}
          for (const [key, value] of Object.entries(attrs)) {
            const isOwn = key === 'as' || key === 'theme' || key === 'class' || key === 'style'
            if (!isOwn && (!filter || filter(key))) forwarded[key] = value
          }
          forwarded.class = className || undefined
          return h(element, forwarded, slots)
        },
        {
          _styles: styler.styles,
          _tag: baseTag,
          _shouldForwardProp: shouldForward,
        } satisfies StyledStatics
      )
      // The attributes are forwarded here, so Vue must not put them on the root a second time.
      Styled.inheritAttrs = false
      return Styled
    }
}
