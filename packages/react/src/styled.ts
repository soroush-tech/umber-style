import {
  createElement,
  isValidElement,
  useInsertionEffect,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from 'react'
import { type Cache, type Engine } from '@umber-style/core'
import { readStyleArguments, withTagShorthands } from '@umber-style/core/internal'
import { useProvidedCache } from './CacheProvider'
import { isStyledComponent, prepareStyled } from './styledParts'
import { useStyleRegistry, type StyleRegistryStore } from './styleRegistry'
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
 * Whether `node`, rendered below an element, can hold a component, the only thing that calls `useId`. It
 * holds none when it is text, nothing, a list of those, or an element of a tag, or of a styled component of
 * a tag (with no component in `as`), whose children hold none: a styled component calls no `useId` itself.
 * Anything else (another component, a fragment, a portal, a promise) is taken to hold one.
 */
function hasComponent(node: unknown): boolean {
  if (typeof node !== 'object' || node === null) return false
  if (Array.isArray(node)) return node.some(hasComponent)
  if (!isValidElement<{ as?: unknown; children?: unknown }>(node)) return true
  const { type, props } = node
  const tag = isStyledComponent(type) ? type._tag : type
  if (typeof tag !== 'string' || (props.as !== undefined && typeof props.as !== 'string'))
    return true
  return hasComponent(props.children)
}

/** What `resolve` of `styledParts.ts` gives for one render. */
interface Resolved {
  element: ElementType
  forwarded: Record<string, unknown>
  className: string
  isHeld: boolean
  hold?: () => () => void
}

/**
 * Makes `styled` over an engine. A component with a function style reads the theme of the nearest
 * provider through `useThemeView`; one with only object styles reads no context, until a `CacheProvider`
 * has rendered: from then on each component reads the cache of the nearest one, and makes its class with
 * the engine over that cache. `createStyleElements` gives the style elements of a class where the build
 * sends them (a server render outside any cache provider), an empty list made once in the browser and
 * under a `StyleRegistry` (`registry`), which takes the texts instead, and undefined where an element has
 * no place for them (under a cache provider, or where the style sends none).
 * In the browser, an element given a plain object in `style` holds the class that object made (`Hold`,
 * rendered after it), so that the class is removed when no element uses it.
 *
 * A server and the browser give the same ids of `useId`, which reads the shape of the tree: the list of the
 * style elements and the place of the `Hold` are there on both sides, empty where they have nothing to do.
 * An element of a tag with no component below it, which has no id below it, drops an empty list.
 */
export function createStyled<T>(
  engine: Engine<T>,
  useThemeView: (cache?: Cache) => T,
  createStyleElements: (
    className: string,
    cache?: Cache,
    registry?: StyleRegistryStore
  ) => readonly ReactElement[] | undefined
): Styled<T> {
  /**
   * The element, with the list of the style elements of its class in front of it where it has a place for
   * them, and the place of its `Hold` after it where `style` holds a plain object.
   */
  const render = (
    { element, forwarded, className, isHeld, hold }: Resolved,
    cache: Cache | undefined,
    registry: StyleRegistryStore | undefined
  ): ReactNode => {
    // React asks for a key in a list it is given. The same one with no list around the element, so that
    // React keeps the element when the list comes and goes (its `Hold`, or its place).
    forwarded.key = 'element'
    const rendered = createElement(element, forwarded)
    let styles = createStyleElements(className, cache, registry)
    // An empty place matters only to a component below the element: a tag with none below it goes alone.
    if (styles?.length === 0 && typeof element === 'string' && !hasComponent(forwarded.children)) {
      styles = undefined
    }
    if (!isHeld) return styles === undefined ? rendered : [styles, rendered]
    // A place for the `Hold`, empty where there is nothing to hold: on a server, or for a class that stays.
    const after = hold === undefined ? null : createElement(Hold, { key: 'hold', hold })
    return styles === undefined ? [rendered, after] : [styles, rendered, after]
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
        const cache = useProvidedCache()
        const registry = useStyleRegistry()
        return render(resolve(props, undefined, canHold(), cache), cache, registry)
      }

      const DynamicStyled = (props: Record<string, unknown>) => {
        const cache = useProvidedCache()
        const registry = useStyleRegistry()
        const view = useThemeView(cache)
        return render(resolve(props, view, canHold(), cache), cache, registry)
      }

      return Object.assign(styler.isDynamic ? DynamicStyled : StaticStyled, statics)
    }
  return withTagShorthands(styled) as unknown as Styled<T>
}
