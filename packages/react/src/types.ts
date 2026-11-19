import type { ComponentProps, ElementType, FunctionComponent, ReactElement, ReactNode } from 'react'
import type {
  BindingOptions,
  Cache,
  ColorScheme,
  DeepPartial,
  Engine,
  ObjectSheet,
  SchemeKey,
  SchemeName,
  SheetEntry,
  SheetStyles,
  StyleInput,
  StylerOptions,
  Theme,
  ThemeKey,
  WebStyleObject,
} from '@umber-style/core'

/** The style types of the core that an app annotates with or uses `satisfies` with. */
export type {
  AlphaColor,
  NestedKey,
  SchemeKey,
  SchemeName,
  SheetEntry,
  StyleObject,
  ThemeKey,
  WebNested,
  WebProperties,
  WebStyleObject,
} from '@umber-style/core'

/** What only the client build of the React binding takes: it can render the style of its classes on a server. */
export interface ServerStyleOptions {
  /**
   * Whether, where there is no `document` (the server render of a client component), a styled element and a
   * theme provider render the `<style href precedence>` elements of their classes, as the server components
   * build does. React moves them to the head and renders each `href` once, so the first HTML of a page
   * is styled whichever build rendered a component. In the browser the client build inserts into its sheet
   * and renders none, whatever this is. Default true. Set it to false when a classic server render
   * puts the CSS of the page into one style element of its own (`extractPageStyles`, `createStyleTag`).
   */
  hasServerStyleElements?: boolean
}

export interface StyleOptions<T = never> extends BindingOptions<T>, ServerStyleOptions {}

export interface DefaultStyleOptions extends BindingOptions<Theme>, ServerStyleOptions {
  /** The base theme, for an app that has no provider at all. */
  theme?: Theme
}

export interface StyledOptions extends StylerOptions {
  /** Whether a prop is forwarded to a string tag. Default: every prop but `as`, `theme`, `className` and `style`, which the component handles itself. */
  shouldForwardProp?: (prop: string) => boolean
}

/** What a styled component keeps, so that styling it again flattens into one element. */
export interface StyledStatics {
  /** Every style of the component, the styles of the components it wraps first. */
  _styles: readonly StyleInput[]
  /** The tag or component that is finally rendered. */
  _tag: ElementType
  _shouldForwardProp?: (prop: string) => boolean
}

/**
 * What the `style` prop of a styled component takes on the web: sheet entries and plain style
 * objects, in arrays, with falsy values dropped. Nothing is rendered as a style attribute: all of it
 * is merged, in order, into the one class of the element, after its own styles and before
 * `className`. A value that changes often (an animated or measured number) makes a new class for
 * each value, so give such a value to a class as a CSS custom property, or drive it another way. A
 * string is an error.
 */
export type StyleProp =
  | SheetEntry
  | WebStyleObject
  | false
  | null
  | undefined
  | readonly StyleProp[]

export type StyledComponent<C extends ElementType, P extends object> = FunctionComponent<
  Omit<ComponentProps<C>, keyof P | 'as' | 'style'> & P & { as?: ElementType; style?: StyleProp }
> &
  StyledStatics

export type Styled<T> = <C extends ElementType>(
  tag: C,
  options?: StyledOptions
) => <P extends object = object>(...styles: StyleInput<T, P>[]) => StyledComponent<C, P>

/** A set of named styles; `E` is what one of them becomes: a class name on the web, a style object on React Native. */
export interface SheetDefinition<S extends SheetStyles, E> {
  /** Never set at run time: it only carries the types. */
  readonly entries?: { [K in keyof S]: E }
}

export interface ThemeProviderProps<T> {
  /** The theme, or the part of it that this subtree changes. */
  readonly theme: DeepPartial<T>
  /** Web only. */
  readonly colorScheme?: ColorScheme
  /** Web only. */
  readonly className?: string
  /** Web only. Renders no element and no class: the app puts `themeClass(theme)` on an ancestor, usually `<html>`. The theme still reaches the engine and the context. */
  readonly isRoot?: boolean
  readonly children?: ReactNode
}

export interface WebThemeProviderProps<T> extends ThemeProviderProps<T> {
  /** The element that carries the theme class. Default 'div'. */
  readonly as?: string
}

export interface Style<T, E> {
  styled: Styled<T>
  StyleSheet: {
    /** A sheet given as an object is its entries, usable at once, with no hook and no theme. */
    create<K extends string>(styles: ObjectSheet<K>): { readonly [P in K]: E }
    /** A sheet given as a function of the theme is for `useStyle`, which resolves it against the theme. */
    create<K extends string>(
      styles: (theme: T) => Record<K, WebStyleObject>
    ): SheetDefinition<Record<K, WebStyleObject>, E>
  }
  /** The entries of a sheet; an object sheet is its own entries and is returned as it is. */
  useStyle<K extends string>(sheet: { readonly [P in K]: E }): { readonly [P in K]: E }
  useStyle<S extends SheetStyles>(sheet: SheetDefinition<S, E>): { [K in keyof S]: E }
  ThemeProvider(props: ThemeProviderProps<T>): ReactElement
  /** The real theme values, for JavaScript that needs a number or a name. */
  useTheme(): T
  /** The class that declares the variables of `theme`; '' on React Native. */
  themeClass(theme: DeepPartial<T>, colorScheme?: ColorScheme): string
  /** A style key for "the nearest theme is this theme": `{ [when(dark)]: { border: ... } }`. On the web it needs `@scope`; on React Native it matches the theme object of the nearest provider. */
  when(theme: DeepPartial<T>, colorScheme?: ColorScheme): ThemeKey
  /** A style key for "the nearest color scheme is this one": the nearest provider given that `colorScheme`, else the system preference. */
  whenScheme(scheme: SchemeName): SchemeKey
}

/** The styling for server components: the root theme of the request is read with readTheme, not with a hook. */
export interface ServerStyle<T> extends Omit<WebStyle<T>, 'useTheme'> {
  /** The root theme of the request, or the base theme of the engine; throws when there is neither. */
  readTheme(): T
}

export interface WebStyle<T> extends Omit<Style<T, SheetEntry>, 'ThemeProvider' | 'apply'> {
  /** The props that apply sheet entries (or class names) to a plain element: a class name. */
  apply(...entries: (SheetEntry | string | null | undefined | false)[]): { className?: string }
  ThemeProvider(props: WebThemeProviderProps<T>): ReactElement
  engine: Engine<T>
  cache: Cache
}
