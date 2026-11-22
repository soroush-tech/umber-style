import type * as CSS from 'csstype'
import type { AlphaColor } from './alpha'

/** A property's value: what the CSS typings allow, or a list of those (fallbacks, tried in order), or nothing. */
type WebValue<V> = V | readonly V[] | null | undefined | false

/** `V` without the "any other string" member that the CSS typings add to a keyword list. */
type Keywords<V> = V extends string ? (string extends V ? never : V) : V

type DisplayOutside = CSS.DataType.DisplayOutside
type DisplayInside = CSS.DataType.DisplayInside

/**
 * `display`: the keywords, and the two- and three-keyword forms (`block flex`, `block flow list-item`).
 * It is the one property whose misspelling is caught, because its grammar is a closed set of keywords.
 */
type DisplayValue =
  | Keywords<CSS.Property.Display>
  | `${DisplayOutside} ${DisplayInside}`
  | `${DisplayInside} ${DisplayOutside}`
  | `${DisplayOutside} list-item`
  | `list-item ${DisplayOutside}`
  | `${DisplayOutside} ${DisplayInside} list-item`

type CssProperties = CSS.Properties<string | number>

/** The properties whose value is a color, and so also take the result of `alpha()`. */
type ColorProperty =
  | 'accentColor'
  | 'background'
  | 'backgroundColor'
  | 'borderBlockColor'
  | 'borderBlockEndColor'
  | 'borderBlockStartColor'
  | 'borderBottomColor'
  | 'borderColor'
  | 'borderInlineColor'
  | 'borderInlineEndColor'
  | 'borderInlineStartColor'
  | 'borderLeftColor'
  | 'borderRightColor'
  | 'borderTopColor'
  | 'caretColor'
  | 'color'
  | 'columnRuleColor'
  | 'fill'
  | 'floodColor'
  | 'lightingColor'
  | 'outlineColor'
  | 'stopColor'
  | 'stroke'
  | 'textDecorationColor'
  | 'textEmphasisColor'

/** The properties whose value is a time, and so also take a number: milliseconds. */
type TimeProperty =
  | 'animationDelay'
  | 'animationDuration'
  | 'transitionDelay'
  | 'transitionDuration'

/** The extra values of property `K`: `alpha()` for a color, a number of milliseconds for a time. */
type ExtraValue<K> =
  | (K extends ColorProperty ? AlphaColor : never)
  | (K extends TimeProperty ? number : never)

/** The values that the CSS typings know for property `K`, with `alpha()` for a color and milliseconds for a time. */
type KnownValue<K extends keyof CssProperties> = K extends 'display'
  ? DisplayValue
  : NonNullable<CssProperties[K]> | ExtraValue<K>

/**
 * The options of the style types, which an app sets by merging into this interface. With `isStrict: true`
 * a web style is checked strictly: a key must be a property, a selector, an at-rule or a custom property,
 * and a property whose values are a closed set of keywords takes only those.
 *
 * ```ts
 * declare module '@umber-style/core' {
 *   interface StyleTypeOptions {
 *     isStrict: true
 *   }
 * }
 * ```
 *
 * Every web binding re-exports it, so `declare module '@umber-style/react'` works too. The optional
 * member below only keeps it from being empty.
 */
export interface StyleTypeOptions {
  readonly _options?: never
}

/** Whether an app switched the strict style types on in `StyleTypeOptions`. */
type IsStrict = StyleTypeOptions extends { isStrict: true } ? true : false

/**
 * The value of property `K`: the values the CSS typings know, which editors complete; by default also any
 * string or number, so an object whose values were widened to `string` is accepted.
 */
type PropertyValue<K extends keyof CssProperties> = IsStrict extends true
  ? WebValue<KnownValue<K>>
  : WebValue<KnownValue<K> | (string & {}) | number>

/**
 * Every CSS property, by its camelCase name, with its value type; a color property also takes `alpha()`,
 * a time property a number of milliseconds. By default a property also takes any string or number; with
 * `isStrict` in `StyleTypeOptions` it takes only the values the CSS typings know.
 */
export type WebProperties = {
  [K in keyof CssProperties]?: PropertyValue<K>
}

/** What a nested key holds: a style of its own, or nothing (so `isOpen && { ... }` works). */
export type WebNested = WebStyleObject | null | undefined | false

/** What a custom property holds. */
type CustomValue = string | number | AlphaColor | null | undefined | false

/**
 * The keys of a web style that are not properties. With `isStrict`: a custom property (`--name`), a
 * selector (a key with `&`, or one that starts with `:`) and an at-rule (a key that starts with `@`). By
 * default any key, so a key computed at run time (whose type is `string`) is accepted too.
 */
type OtherKey = IsStrict extends true
  ? `--${string}` | `${string}&${string}` | `:${string}` | `@${string}`
  : string

/** What the key `K` holds: with `isStrict`, a value for a custom property and a nested style for the others; by default either. */
type OtherValue<K> = IsStrict extends true
  ? K extends `--${string}`
    ? CustomValue
    : WebNested
  : WebNested | WebValue<string | number | AlphaColor>

/**
 * A style for the web: any CSS property, a custom property (`--name`), `label`, and nested styles under
 * a selector (a key with `&`, or one that starts with `:`) or an at-rule (a key that starts with `@`).
 * By default any other key is accepted too, with a nested style or a value, and a property takes any
 * string or number besides its known values. With `isStrict` in `StyleTypeOptions` any other key is an
 * error in an object literal, and so is a value that is not one of a closed set of keywords.
 */
export type WebStyleObject = WebProperties & {
  /** Part of the class name, for a readable class in the developer tools. */
  label?: string
} & { [K in OtherKey]: OtherValue<K> }
