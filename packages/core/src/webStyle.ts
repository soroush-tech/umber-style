import type * as CSS from 'csstype'

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

/** Every CSS property, by its camelCase name, with its value type. */
export type WebProperties = {
  [K in keyof CssProperties]?: K extends 'display'
    ? WebValue<DisplayValue>
    : WebValue<NonNullable<CssProperties[K]>>
}

/** What a nested key holds: a style of its own, or nothing (so `isOpen && { ... }` works). */
type WebNested = WebStyleObject | null | undefined | false

/**
 * A style for the web: any CSS property, a custom property (`--name`), `label`, and nested styles under
 * a selector (a key with `&`, or one that starts with `:`) or an at-rule (a key that starts with `@`).
 * Any other key is an error in an object literal.
 */
export type WebStyleObject = WebProperties & {
  /** Part of the class name, for a readable class in the developer tools. */
  label?: string
  [key: `--${string}`]: string | number | null | undefined | false
  [key: `${string}&${string}`]: WebNested
  [key: `:${string}`]: WebNested
  [key: `@${string}`]: WebNested
}
