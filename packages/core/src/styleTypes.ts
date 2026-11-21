import type { AlphaColor } from './alpha'
import type { keyframes } from './keyframes'
import type { SheetEntry } from './sheetEntry'
import type { Theme } from './types'
import type { WebStyleObject } from './webStyle'

/** A style written as an object, on the web: `WebStyleObject`, under the name apps annotate a style with. */
export type CSSObject = WebStyleObject

/** What `keyframes` returns: the name of the animation, a plain string. */
export type Keyframes = ReturnType<typeof keyframes>

/**
 * What `css()` of a web binding returns: a sheet entry of the merged style. It prints as its class name,
 * and goes wherever an entry goes: the `style` prop of a styled component, `apply`, another `css()`.
 */
export type SerializedStyles = SheetEntry

/** What a style function may return: a style object, a `css()` result or a sheet entry, or nothing. */
export type InterpolationResult = CSSObject | SerializedStyles | null | undefined | false

/**
 * A style in any form that `styled` takes: a style object, a `css()` result or a sheet entry, a function
 * of the props and the theme, nothing, or a list of them. `css()` takes the same without functions
 * (`CssArgument`): it has no props.
 */
export type Interpolation<Props = unknown, T = Theme> =
  | InterpolationResult
  | ((props: Props & { theme: T }) => InterpolationResult)
  | readonly Interpolation<Props, T>[]

/** What `css()` of a binding takes: style objects, `css()` results and sheet entries, nothing, and lists of them. */
export type CssArgument = InterpolationResult | readonly CssArgument[]

/** A component that stands for a selector in a template or a key: a styled component prints as `.<class>`. */
export interface ComponentSelector {
  readonly _styles: readonly unknown[]
}

/**
 * What a tagged template given to `css`, `keyframes` or `globalStyles` takes between its strings: text
 * and numbers, a style object or a `css()` result (merged where it stands alone between declarations), an
 * `alpha()` result, a `keyframes` name, a styled component (its selector), nothing (`null`, `undefined`,
 * `true`, `false`), and lists of them.
 */
export type StaticTemplateValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | CSSObject
  | SerializedStyles
  | AlphaColor
  | ComponentSelector
  | readonly StaticTemplateValue[]

/**
 * What a tagged template given to `styled` takes between its strings: what `StaticTemplateValue` lists,
 * and a function of the props and the theme that returns one of them. A `keyframes` or `globalStyles`
 * template calls such a function with `{ theme }`.
 */
export type TemplateValue<Props = unknown, T = Theme> =
  | StaticTemplateValue
  | ((props: Props & { theme: T }) => TemplateValue<Props, T>)
  | readonly TemplateValue<Props, T>[]
