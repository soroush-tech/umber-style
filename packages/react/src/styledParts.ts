import type { ElementType } from 'react'
import { flattenStyle, type Engine, type StyleInput } from '@umber-style/core'
import type { StyledOptions, StyledStatics } from './types'

/** Whether `tag` is a component made by `styled`. */
function isStyledComponent(tag: ElementType): tag is ElementType & StyledStatics {
  return typeof tag === 'function' && '_styles' in tag
}

/** What both builds of `styled` share: the styler, and the element and props that a component renders. */
export function prepareStyled<T>(
  engine: Engine<T>,
  tag: ElementType,
  options: StyledOptions,
  styles: StyleInput[]
) {
  const inner = isStyledComponent(tag) ? tag : undefined
  const baseTag = inner?._tag ?? tag
  const shouldForward = options.shouldForwardProp ?? inner?._shouldForwardProp
  const styler = engine.createStyler(options, styles, inner?._styles)

  /** The element, its props and the engine class for `props`; `theme` is the view that function styles read. */
  const resolve = (props: Record<string, unknown>, theme?: T) => {
    // Everything in the style prop, entries and plain objects, joins the one class, after the styles.
    // No style attribute is ever rendered.
    const className = styler.getClassName(
      props,
      [...flattenStyle(props.style), props.className as string | undefined],
      theme
    )
    const element = (props.as as ElementType | undefined) ?? baseTag
    const filter = typeof element === 'string' ? shouldForward : undefined

    const forwarded: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(props)) {
      const isOwn = key === 'as' || key === 'theme' || key === 'className' || key === 'style'
      if (!isOwn && (!filter || filter(key))) forwarded[key] = value
    }
    forwarded.className = className || undefined
    return { element, forwarded, className }
  }

  const statics: StyledStatics = {
    _styles: styler.styles,
    _tag: baseTag,
    _shouldForwardProp: shouldForward,
  }

  return { styler, resolve, statics }
}
