import type { ElementType } from 'react'
import {
  createComponentSelector,
  flattenStyle,
  type Cache,
  type Engine,
  type StyleInput,
  type Styler,
} from '@umber-style/core'
import { isDomProp } from './domProps'
import type { StyledOptions, StyledStatics } from './types'

/** Whether `tag` is a component made by `styled`. */
function isStyledComponent(tag: ElementType): tag is ElementType & StyledStatics {
  return typeof tag === 'function' && '_styles' in tag
}

/** The filter of the props of `element`: the one given, whatever the element is; else for a string tag the attributes of HTML and SVG (a custom element, with a hyphen in its name, receives every prop), and none for a component. */
function readFilter(element: ElementType, given: ((prop: string) => boolean) | undefined) {
  if (given || typeof element !== 'string') return given
  return element.includes('-') ? undefined : isDomProp
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
  // `as` replaces the base unless the filter forwards it. A string tag is always replaced: its default
  // filter does not forward `as`, and a filter given for it is not asked. A component's default forwards
  // every prop, so it is replaced only by a filter that keeps `as` off.
  const isReplaced =
    typeof baseTag === 'string' || (shouldForward !== undefined && !shouldForward('as'))
  const target = [inner?._target, options.target].filter(Boolean).join(' ') || undefined
  const styler = engine.createStyler(options, styles, inner?._styles)
  // The styler of the engine over each other cache (a cache provider's), made on first use.
  const stylers = new WeakMap<Engine<T>, Styler>()
  const readStyler = (cache: Cache): Styler => {
    const local = engine.withCache(cache)
    if (local === engine) return styler
    let made = stylers.get(local)
    if (made === undefined) {
      made = local.createStyler(options, styles, inner?._styles)
      stylers.set(local, made)
    }
    return made
  }

  /**
   * The element, its props and the engine class for `props`; `theme` is the view that function styles
   * read. With `canHold` (the browser), a plain object in `style` makes a class that the element holds:
   * `hold` counts it, and is undefined when there is nothing to hold. With `cache` (a cache provider's)
   * the class is made by the engine over that cache, and written there.
   */
  const resolve = (props: Record<string, unknown>, theme?: T, canHold = false, cache?: Cache) => {
    const own = cache === undefined ? styler : readStyler(cache)
    // Everything in the style prop, entries and plain objects, joins the one class, after the styles.
    // No style attribute is ever rendered.
    const extra = [...flattenStyle(props.style), props.className as string | undefined]
    const held = canHold && props.style ? own.getHeldClass(props, extra, theme) : undefined
    let className = held ? held.className : own.getClassName(props, extra, theme)
    if (target) className = className ? `${className} ${target}` : target
    const element = isReplaced ? ((props.as as ElementType | undefined) ?? baseTag) : baseTag
    const filter = readFilter(element, shouldForward)

    const forwarded: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(props)) {
      const isOwn =
        (isReplaced && key === 'as') || key === 'theme' || key === 'className' || key === 'style'
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
    // The component as a selector in a template or a key: `${Button}:hover &`.
    toString: createComponentSelector(options.target, styler),
  }

  return { styler, resolve, statics }
}
