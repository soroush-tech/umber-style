import { h, normalizeClass, type Component } from 'vue'
import {
  createComponentSelector,
  flattenStyle,
  readStyleArguments,
  withTagShorthands,
  type Engine,
} from '@umber-style/core'
import type { Styled, StyledComponent, StyledOptions, StyledStatics } from './types'

/** Whether `tag` is a component made by `styled`. */
function isStyledComponent(tag: string | Component): tag is StyledComponent {
  return typeof tag === 'function' && '_styles' in tag
}

/** The function that lets go of the class that each element (or component instance) holds. */
const releases = new WeakMap<object, () => void>()

/**
 * The function ref that makes the element hold the class of `hold`. Vue calls the ref of each render
 * with the element when it patches it, and the last one with null when the element is unmounted or no
 * longer has a ref: the element then holds the new class first and lets the old one go, or lets its
 * class go. A functional component has no lifecycle of its own; the ref is the element's.
 */
function createHoldRef(hold: () => () => void) {
  let element: object | undefined
  return (value: unknown) => {
    if (value) {
      element = value as object
      const previous = releases.get(element)
      releases.set(element, hold())
      previous?.()
    } else {
      releases.get(element as object)?.()
      releases.delete(element as object)
    }
  }
}

/**
 * Makes `styled` over an engine: a functional component that renders the tag with one class. A
 * function style gets the view of the theme of the nearest provider, which `useThemeView` reads. In the
 * browser, an element given a plain object in `style` holds the class that the object made, so that the
 * class is removed when no element uses it.
 */
export function createStyled<T>(engine: Engine<T>, useThemeView: () => T): Styled<T> {
  const styled =
    (tag: string | Component, options: StyledOptions = {}) =>
    (...args: unknown[]) => {
      // Called with styles, or as a tag: a template is one style.
      const styles = readStyleArguments(args)
      const inner = isStyledComponent(tag) ? tag : undefined
      const baseTag = inner?._tag ?? tag
      const shouldForward = options.shouldForwardProp ?? inner?._shouldForwardProp
      const target = [inner?._target, options.target].filter(Boolean).join(' ') || undefined
      const styler = engine.createStyler(options, styles, inner?._styles)

      const Styled: StyledComponent = Object.assign(
        (
          _props: Record<string, unknown>,
          { attrs, slots }: Pick<Parameters<StyledComponent>[1], 'attrs' | 'slots'>
        ) => {
          // Everything in the style attribute, entries and plain objects, joins the one class, after
          // the styles. No style attribute is ever rendered; a string is an error.
          const extra = [
            ...flattenStyle(attrs.style, engine.cache.findEntry),
            normalizeClass(attrs.class),
          ]
          const theme = styler.isDynamic ? useThemeView() : undefined
          // Only the browser lets a class go; a server render keeps every class.
          const held =
            typeof document !== 'undefined' && attrs.style
              ? styler.getHeldClass(attrs, extra, theme)
              : undefined
          let className = held ? held.className : styler.getClassName(attrs, extra, theme)
          if (target) className = className ? `${className} ${target}` : target
          const element = (attrs.as as string | Component | undefined) ?? baseTag
          const filter = typeof element === 'string' ? shouldForward : undefined

          const forwarded: Record<string, unknown> = {}
          for (const [key, value] of Object.entries(attrs)) {
            const isOwn = key === 'as' || key === 'theme' || key === 'class' || key === 'style'
            if (!isOwn && (!filter || filter(key))) forwarded[key] = value
          }
          forwarded.class = className || undefined
          if (held?.hold) forwarded.ref = createHoldRef(held.hold)
          return h(element, forwarded, slots)
        },
        {
          _styles: styler.styles,
          _tag: baseTag,
          _shouldForwardProp: shouldForward,
          _target: target,
          // The component as a selector in a template or a key: `${Button}:hover &`.
          toString: createComponentSelector(options.target, styler),
        } satisfies StyledStatics
      )
      // The attributes are forwarded here, so Vue must not put them on the root a second time.
      Styled.inheritAttrs = false
      return Styled
    }
  return withTagShorthands(styled) as unknown as Styled<T>
}
