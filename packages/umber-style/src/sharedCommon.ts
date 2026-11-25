// What the types of `umber-style/react` share under every export condition: the styling that runs on the
// web and on React Native, `useTheme` with it, and in server components (`shared.server.ts` adds
// `readTheme`, `shared.ts` the context and the portal helpers). This file holds types and declarations
// only: it is never loaded.
import type { ComponentProps, ElementType, FunctionComponent, ReactElement } from 'react'
import type {
  ColorScheme,
  DeepPartial,
  GlobalStyles,
  GlobalStylesInput,
  KeyframesInput,
  KeyframesOptions,
  NestedKey,
  SchemeKey,
  SchemeName,
  SheetEntry,
  StateKey,
  StateName,
  StaticTemplateValue,
  ThemeKey,
  WebNested,
  WebProperties,
  WebStyleObject,
} from '@umber-style/core'
import type {
  DefaultStyleOptions,
  GlobalProps,
  StyledOptions,
  Theme,
  ThemeProviderProps,
} from '@umber-style/react'
import type { AnimatedDriver, NativeStyleObject, StateProps } from '@umber-style/react-native'

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

/** A component that `styled` made in shared code: the props of its tag and its own, the state props, with `as` and a shared `style`. */
export type SharedStyledComponent<C extends ElementType, P extends object> = FunctionComponent<
  Omit<ComponentProps<C>, keyof P | 'as' | 'style'> &
    P &
    StateProps & { as?: ElementType; style?: SharedStyleProp }
>

/** `styled` in shared code: a tag or a component and its options, then the styles of the component. */
export type SharedStyled<T> = <C extends ElementType>(
  tag: C,
  options?: StyledOptions
) => <P extends object = object>(...styles: SharedStyleInput<T, P>[]) => SharedStyledComponent<C, P>

/** A set of named styles; it only carries the types. */
export interface SharedSheetDefinition<S extends SharedSheetStyles> {
  /** Never set: it only gives the sheet the names of its entries. */
  readonly entries?: { [K in keyof S]: SharedEntry }
}

/** `StyleSheet` in shared code: it makes sheets of named styles. */
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
  /** The class names of the entries, on the web. */
  className?: string
  /** The entries, on React Native. */
  style?: readonly SharedEntry[]
}

/** What `css()` takes in shared code: shared style objects, entries and `css()` results, nothing, and lists of them. */
export type SharedCssArgument =
  | SharedStyleObject
  | SharedEntry
  | false
  | null
  | undefined
  | readonly SharedCssArgument[]

/**
 * `css()` in shared code: one style made once and passed around, from styles or from a tagged template. On
 * the web it is a sheet entry (its text is its class name), on React Native the merged native style.
 */
export interface SharedCss {
  // The styles last, so that a mistake in a style object is reported against a style.
  (template: TemplateStringsArray, ...values: StaticTemplateValue[]): SharedEntry
  (...styles: SharedCssArgument[]): SharedEntry
}

/** `apply` in shared code: the props that put sheet entries and class names on a styled component. */
export type SharedApply = (
  ...entries: (SharedEntry | string | null | undefined | false)[]
) => SharedApplied

/** The styling of one theme shape: the names that both platforms and server components have. */
export interface SharedStyleBase<T> {
  /**
   * The real theme values. In a component of the client: of the nearest provider, else the base theme,
   * else an empty object. In a server component: the base theme, the same in every render; mark a
   * component `'use client'` for the nearest provider's values, its code unchanged.
   */
  useTheme(): T
  /** Makes a styled component of a tag or a component. */
  styled: SharedStyled<T>
  /** Makes sheets of named styles. */
  StyleSheet: SharedStyleSheet<T>
  /** The entries of a sheet; an object sheet is its own entries and is returned as it is. */
  useStyle<K extends string>(sheet: { readonly [P in K]: SharedEntry }): {
    readonly [P in K]: SharedEntry
  }
  /** The entries of a sheet made from a function of the theme, resolved against the nearest provider. */
  useStyle<S extends SharedSheetStyles>(
    sheet: SharedSheetDefinition<S>
  ): { [K in keyof S]: SharedEntry }
  /** The props that put sheet entries on a styled component: a class name on the web, a style array on React Native. */
  apply: SharedApply
  /** One style made once and passed around: a sheet entry on the web, the merged native style on React Native. Pass it on; do not read it. */
  css: SharedCss
  /** Gives the subtree a theme, merged over the theme above. */
  ThemeProvider(props: ThemeProviderProps<T>): ReactElement
  /** On the web, the class string of a theme (and a color scheme), for an element the app renders itself; on React Native, an empty string. */
  themeClass(theme: DeepPartial<T>, colorScheme?: ColorScheme): string
  /** A style key for "the nearest theme is this theme", at the top of a style or inside `web` or `native`. On the web it needs `@scope`; on React Native it matches the theme object of the nearest provider. */
  when(theme: DeepPartial<T>, colorScheme?: ColorScheme): ThemeKey
  /** A style key for "the nearest color scheme is this one": the nearest theme given that `colorScheme`, else the system preference. */
  whenScheme(scheme: SchemeName): SchemeKey
  /** Registers an animation and returns its name, for `animationName` or `animation` in the `web` part. On React Native the name only: nothing runs it. */
  keyframes(steps: KeyframesInput<T>, options?: KeyframesOptions): string
  /** Makes global styles and returns their handle, for `Global`. */
  globalStyles(styles: GlobalStylesInput<T>): GlobalStyles<T>
  /** Writes global styles while it is rendered, on the web; renders nothing and does nothing on React Native. */
  Global(props: GlobalProps<T>): ReactElement | null
}

/**
 * The option of `createStyle` and `configure` that only React Native reads: `animated` of
 * `umber-style/react-native/animated` runs the animation and transition keys there. The web accepts it
 * and ignores it: its CSS runs them.
 */
export interface MotionOptions {
  /** The animated entry on React Native; `undefined` on the web. */
  animated?: AnimatedDriver
}

export type { DefaultStyleOptions, GlobalProps, StyledOptions, ThemeProviderProps }
export type { StyleOptions } from '@umber-style/react'
export type { SheetEntry, Theme }
export type {
  AlphaColor,
  GlobalInput,
  GlobalStyleObject,
  GlobalStyles,
  KeyframesSteps,
  StyleObject,
  StyleTypeOptions,
} from '@umber-style/core'
export type {
  NestedKey,
  SchemeKey,
  SchemeName,
  StateKey,
  StateName,
  StateProps,
  ThemeKey,
  WebNested,
  WebProperties,
  WebStyleObject,
}

export declare const configure: (options: DefaultStyleOptions & MotionOptions) => void
export declare const styled: SharedStyled<Theme>
export declare const StyleSheet: SharedStyleSheet<Theme>
export declare const useStyle: SharedStyleBase<Theme>['useStyle']
export declare const useTheme: SharedStyleBase<Theme>['useTheme']
export declare const ThemeProvider: SharedStyleBase<Theme>['ThemeProvider']
export declare const apply: SharedApply
export declare const css: SharedCss
export declare const themeClass: SharedStyleBase<Theme>['themeClass']
export declare const when: SharedStyleBase<Theme>['when']
export declare const whenScheme: SharedStyleBase<Theme>['whenScheme']
export declare const keyframes: SharedStyleBase<Theme>['keyframes']
export declare const globalStyles: SharedStyleBase<Theme>['globalStyles']
export declare const Global: SharedStyleBase<Theme>['Global']
/** `color` at `opacity` (0 to 1): a CSS mix on the web, rgba() on React Native. */
export declare const alpha: (color: string, opacity: number) => string
/** `{ [key]: style }` typed so that it spreads into a web style, for a key that is computed: `web: { ...at(`@media (width >= ${bp})`, { gap: 16 }) }`. */
export declare function at<K extends NestedKey>(key: K, style: WebNested): Record<K, WebNested>
/**
 * The key of a style for "while the element is in the state `name`", for `at`:
 * `...at(state('pressed'), { opacity: 0.7 })`. On the web it is the selector written by hand for it
 * (`&:hover`, `&:active`, `&:focus-visible`, `&:disabled, &[aria-disabled="true"]`); on React Native the
 * binding follows the state of the component.
 */
export declare function state(name: StateName): StateKey
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
