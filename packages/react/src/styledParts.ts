import type { ElementType } from 'react'
import { flattenStyle, type Engine, type StyleInput } from '@umber-style/core'
import { isDomProp } from './domProps'
import type { StyledOptions, StyledStatics } from './types'

/** Whether `tag` is a component made by `styled`. */
function isStyledComponent(tag: ElementType): tag is ElementType & StyledStatics {
  return typeof tag === 'function' && '_styles' in tag
}

/** The filter of the props of `element`: the one given, else for a string tag the attributes of HTML and SVG (a custom element, with a hyphen in its name, receives every prop); none for a component. */
function readFilter(element: ElementType, given: ((prop: string) => boolean) | undefined) {
  if (typeof element !== 'string') return undefined
  return given ?? (element.includes('-') ? undefined : isDomProp)
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
  const target = [inner?._target, options.target].filter(Boolean).join(' ') || undefined
  const styler = engine.createStyler(options, styles, inner?._styles)

  /**
   * The element, its props and the engine class for `props`; `theme` is the view that function styles
   * read. With `canHold` (the browser), a plain object in `style` makes a class that the element holds:
   * `hold` counts it, and is undefined when there is nothing to hold.
   */
  const resolve = (props: Record<string, unknown>, theme?: T, canHold = false) => {
    // Everything in the style prop, entries and plain objects, joins the one class, after the styles.
    // No style attribute is ever rendered.
    const extra = [...flattenStyle(props.style), props.className as string | undefined]
    const held = canHold && props.style ? styler.getHeldClass(props, extra, theme) : undefined
    let className = held ? held.className : styler.getClassName(props, extra, theme)
    if (target) className = className ? `${className} ${target}` : target
    const element = (props.as as ElementType | undefined) ?? baseTag
    const filter = readFilter(element, shouldForward)

    const forwarded: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(props)) {
      const isOwn = key === 'as' || key === 'theme' || key === 'className' || key === 'style'
      if (!isOwn && (!filter || filter(key))) forwarded[key] = value
    }
    forwarded.className = className || undefined
    return { element, forwarded, className, hold: held?.hold }
  }

  const statics: StyledStatics = {
    _styles: styler.styles,
    _tag: baseTag,
    _shouldForwardProp: shouldForward,
    _target: target,
  }

  return { styler, resolve, statics }
}
