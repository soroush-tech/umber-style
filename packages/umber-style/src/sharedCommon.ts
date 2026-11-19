// What the types of `umber-style/react` share under every export condition: the styling that runs on the
// web and on React Native, apart from the theme hook (`useTheme` in `shared.ts`, `readTheme` in
// `shared.server.ts`). This file holds types and declarations only: it is never loaded.
import type { ComponentProps, ElementType, FunctionComponent, ReactElement } from 'react'
import type {
  ColorScheme,
  DeepPartial,
  NestedKey,
  SchemeKey,
  SchemeName,
  SheetEntry,
  Theme,
  ThemeKey,
  WebNested,
  WebProperties,
  WebStyleObject,
} from '@umber-style/core'
import type { DefaultStyleOptions, StyledOptions, ThemeProviderProps } from '@umber-style/react'
import type { NativeStyleObject } from '@umber-style/react-native'

/** The keys that the web style and the native style both have. */
type SharedKeys = keyof WebProperties & keyof NativeStyleObject

/**
 * The part of a style that both platforms understand: the keys that are in both types, each with the
 * values that are valid in both (a number, a percentage and `auto` are; `grid` and `10px` are not).
 */
export type SharedProperties = {
  [K in SharedKeys]?: WebProperties[K] & NativeStyleObject[K]
}

/**
 * A style for web and mobile: the keys valid on both, plus two parts for one platform each. On the web
 * `web` is merged over the rest and `native` is dropped; on React Native it is the other way round.
 */
export type SharedStyleObject = SharedProperties & {
  /** Only on the web: nested selectors, at-rules, any CSS property. */
  web?: WebStyleObject | null | false
  /** Only on React Native: any key of the platform's styles. */
  native?: NativeStyleObject | null | false
}

/** What a shared style function may return. */
export type SharedStyleResult = SharedStyleObject | null | undefined | false

/** A shared style that is computed from the props and the theme. */
export type SharedStyleFunction<T, P> = (props: P & { theme: T }) => SharedStyleResult

/** A shared style object, or a function of the props and the theme; the defaults accept any function. */
export type SharedStyleInput<T = never, P = never> = SharedStyleObject | SharedStyleFunction<T, P>

/** A set of named shared styles. */
export type SharedSheetStyles = Record<string, SharedStyleObject>

/** What a shared sheet is made from: one style for each name, or a function of the theme that returns them. */
export type SharedSheetInput<K extends string, T> =
  | Record<K, SharedStyleObject>
  | ((theme: T) => Record<K, SharedStyleObject>)

/** A shared sheet given as an object: one style for each name, with a function left out (the compiler tries the object form first). */
export type SharedObjectSheet<K extends string> = Record<K, SharedStyleObject> & { call?: never }

/** An entry of a sheet: a class name on the web, a style object on React Native. Pass it on; do not read it. */
export type SharedEntry = SheetEntry | NativeStyleObject

/** What the `style` prop of a shared styled component takes. */
export type SharedStyleProp =
  | SharedEntry
  | SharedStyleObject
  | false
  | null
  | undefined
  | readonly SharedStyleProp[]

export type SharedStyledComponent<C extends ElementType, P extends object> = FunctionComponent<
  Omit<ComponentProps<C>, keyof P | 'as' | 'style'> &
    P & { as?: ElementType; style?: SharedStyleProp }
>

export type SharedStyled<T> = <C extends ElementType>(
  tag: C,
  options?: StyledOptions
) => <P extends object = object>(...styles: SharedStyleInput<T, P>[]) => SharedStyledComponent<C, P>

/** A set of named styles; it only carries the types. */
export interface SharedSheetDefinition<S extends SharedSheetStyles> {
  readonly entries?: { [K in keyof S]: SharedEntry }
}

export interface SharedStyleSheet<T> {
  /** A sheet given as an object is its entries, usable at once, with no hook and no theme. */
  create<K extends string>(styles: SharedObjectSheet<K>): { readonly [P in K]: SharedEntry }
  /** A sheet given as a function of the theme is for `useStyle`, which resolves it against the theme. */
  create<K extends string>(
    styles: (theme: T) => Record<K, SharedStyleObject>
  ): SharedSheetDefinition<Record<K, SharedStyleObject>>
}

/** The props that apply entries to a styled component: a class name on the web, a style array on React Native. */
export interface SharedApplied {
  className?: string
  style?: readonly SharedEntry[]
}

export type SharedApply = (
  ...entries: (SharedEntry | string | null | undefined | false)[]
) => SharedApplied

/** The styling of one theme shape without its theme hook: the names that both platforms have. */
export interface SharedStyleBase<T> {
  styled: SharedStyled<T>
  StyleSheet: SharedStyleSheet<T>
  /** The entries of a sheet; an object sheet is its own entries and is returned as it is. */
  useStyle<K extends string>(sheet: { readonly [P in K]: SharedEntry }): {
    readonly [P in K]: SharedEntry
  }
  useStyle<S extends SharedSheetStyles>(
    sheet: SharedSheetDefinition<S>
  ): { [K in keyof S]: SharedEntry }
  apply: SharedApply
  ThemeProvider(props: ThemeProviderProps<T>): ReactElement
  themeClass(theme: DeepPartial<T>, colorScheme?: ColorScheme): string
  /** A style key for "the nearest theme is this theme", at the top of a style or inside `web` or `native`. On the web it needs `@scope`; on React Native it matches the theme object of the nearest provider. */
  when(theme: DeepPartial<T>, colorScheme?: ColorScheme): ThemeKey
  /** A style key for "the nearest color scheme is this one": the nearest theme given that `colorScheme`, else the system preference. */
  whenScheme(scheme: SchemeName): SchemeKey
}

export type { DefaultStyleOptions, StyledOptions, ThemeProviderProps }
export type { StyleOptions } from '@umber-style/react'
export type { SheetEntry, Theme }
export type { AlphaColor, StyleObject } from '@umber-style/core'
export type { NestedKey, SchemeKey, SchemeName, ThemeKey, WebNested, WebProperties, WebStyleObject }

export declare const configure: (options: DefaultStyleOptions) => void
export declare const styled: SharedStyled<Theme>
export declare const StyleSheet: SharedStyleSheet<Theme>
export declare const useStyle: SharedStyleBase<Theme>['useStyle']
export declare const ThemeProvider: SharedStyleBase<Theme>['ThemeProvider']
export declare const apply: SharedApply
export declare const themeClass: SharedStyleBase<Theme>['themeClass']
export declare const when: SharedStyleBase<Theme>['when']
export declare const whenScheme: SharedStyleBase<Theme>['whenScheme']
/** `color` at `opacity` (0 to 1): a CSS mix on the web, rgba() on React Native. */
export declare const alpha: (color: string, opacity: number) => string
/** `{ [key]: style }` typed so that it spreads into a web style, for a key that is computed: `web: { ...at(`@media (width >= ${bp})`, { gap: 16 }) }`. */
export declare function at<K extends NestedKey>(key: K, style: WebNested): Record<K, WebNested>
/** A percentage: `'50%'`. */
export type SharedPercent = `${number}%`

/**
 * `value` times `factor`. A token is typed as the number it is on React Native; on the web it is a
 * `var(--x)` reference and the result is a CSS `calc()` that the browser computes. Percentages are the one
 * string that both platforms compute.
 */
export declare function multiply(value: number, factor: number): number
export declare function multiply(value: SharedPercent, factor: number): number | SharedPercent
/** `value` divided by `divisor`; a `divisor` of 0 throws a `RangeError`. */
export declare function divide(value: number, divisor: number): number
export declare function divide(value: SharedPercent, divisor: number): number | SharedPercent
/** The sum of `values`: all numbers, or all percentages. */
export declare function add(...values: number[]): number
export declare function add(...values: SharedPercent[]): number | SharedPercent
/** `value` minus each of `values`: all numbers, or all percentages. */
export declare function subtract(value: number, ...values: number[]): number
export declare function subtract(
  value: SharedPercent,
  ...values: SharedPercent[]
): number | SharedPercent
/** `value` times -1: a negative margin from a token. */
export declare function negate(value: number): number
export declare function negate(value: SharedPercent): number | SharedPercent
