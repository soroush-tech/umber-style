import type {
  ComponentProps,
  Context,
  ElementType,
  FunctionComponent,
  JSX,
  ReactElement,
  ReactNode,
} from 'react'
import type {
  BindingOptions,
  Cache,
  ColorScheme,
  DeepPartial,
  Engine,
  GlobalInput,
  GlobalStyles,
  GlobalStylesInput,
  KeyframesInput,
  KeyframesOptions,
  ObjectSheet,
  SchemeKey,
  SchemeName,
  SheetEntry,
  SheetStyles,
  StyleInput,
  StylerOptions,
  Theme,
  ThemeInput,
  ThemeKey,
  WebStyleObject,
} from '@umber-style/core'

/** The style types of the core that an app annotates with or uses `satisfies` with. */
export type {
  AlphaColor,
  GlobalInput,
  GlobalStyleObject,
  GlobalStyles,
  KeyframesSteps,
  NestedKey,
  SchemeKey,
  SchemeName,
  SheetEntry,
  StyleObject,
  ThemeInput,
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
  /**
   * Whether a prop is forwarded to a string tag. It replaces the default, which forwards the attributes
   * of HTML and SVG (by their React names), `data-*`, `aria-*`, event handlers and React's own props, and
   * every prop to a custom element (a tag with a hyphen). `as`, `theme`, `className` and `style` are the
   * component's own and are never forwarded. A component tag receives every prop but those four.
   */
  shouldForwardProp?: (prop: string) => boolean
  /**
   * A class name of your own that the element always has, after the engine's classes: a stable name
   * that a parent's selector or a test can find. It is not a style and has no rule. A component that
   * wraps this one keeps it, and adds its own.
   */
  target?: string
}

/** What a styled component keeps, so that styling it again flattens into one element. */
export interface StyledStatics {
  /** Every style of the component, the styles of the components it wraps first. */
  _styles: readonly StyleInput[]
  /** The tag or component that is finally rendered. */
  _tag: ElementType
  _shouldForwardProp?: (prop: string) => boolean
  /** The `target` classes of the component and of the components it wraps. */
  _target?: string
}

/**
 * What the `style` prop of a styled component takes on the web: sheet entries and plain style
 * objects, in arrays, with falsy values dropped. Nothing is rendered as a style attribute: all of it
 * is merged, in order, into the one class of the element, after its own styles and before
 * `className`. In the browser, a class made with a plain object is removed once no element uses it, so
 * a value that changes often leaves no class behind; each new value still writes a rule. A string is
 * an error.
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

/** What `styled(tag, options)` returns: it takes the styles and makes the component. */
export type StyledFactory<T, C extends ElementType> = <P extends object = object>(
  ...styles: StyleInput<T, P>[]
) => StyledComponent<C, P>

/** The shorthand of each HTML and SVG tag: `styled.div(...styles)` is `styled('div')(...styles)`. */
export type StyledTags<T> = {
  readonly [K in keyof JSX.IntrinsicElements]: StyledFactory<T, K>
}

export type Styled<T> = (<C extends ElementType>(
  tag: C,
  options?: StyledOptions
) => StyledFactory<T, C>) &
  StyledTags<T>

/** A set of named styles; `E` is what one of them becomes: a class name on the web, a style object on React Native. */
export interface SheetDefinition<S extends SheetStyles, E> {
  /** Never set at run time: it only carries the types. */
  readonly entries?: { [K in keyof S]: E }
}

export interface ThemeProviderProps<T> {
  /**
   * The theme, or the part of it that this subtree changes; or a function of the theme above (the base
   * theme, or an empty object, for the outermost provider) that returns it. It is merged over the theme above.
   */
  readonly theme: ThemeInput<T>
  /** Web only. */
  readonly colorScheme?: ColorScheme
  /** Web only: a class of the wrapper of a nested provider. */
  readonly className?: string
  /**
   * Web only. Renders no element, no class and no rule: the app puts `themeClass(theme)` on an ancestor,
   * usually `<html>`. The theme still reaches the engine and the context. Without it the outermost provider
   * declares its theme on `:root`, and renders no element either.
   */
  readonly isRoot?: boolean
  readonly children?: ReactNode
}

export interface ThemeScopeProps {
  readonly children?: ReactNode
}

export interface GlobalProps<T> {
  /**
   * The global styles: a handle that `globalStyles` made, a style object, a function of the theme, or a
   * list of them, written in the order of the list. A function of the theme reads the nearest provider:
   * tokens are references, raw keys (`breakpoints`) are its real values.
   */
  readonly styles: GlobalInput<T>
}

export interface WebThemeProviderProps<T> extends ThemeProviderProps<T> {
  /** The element of the wrapper of a nested provider. Default 'div'. */
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
  /** The real theme values, for JavaScript that needs a number or a name: of the nearest provider, else the base theme, else an empty object. */
  useTheme(): T
  /** The class that declares the variables of `theme`; '' on React Native. */
  themeClass(theme: DeepPartial<T>, colorScheme?: ColorScheme): string
  /** A style key for "the nearest theme is this theme": `{ [when(dark)]: { border: ... } }`. On the web it needs `@scope`; on React Native it matches the theme object of the nearest provider. */
  when(theme: DeepPartial<T>, colorScheme?: ColorScheme): ThemeKey
  /** A style key for "the nearest color scheme is this one": the nearest provider given that `colorScheme`, else the system preference. */
  whenScheme(scheme: SchemeName): SchemeKey
  /**
   * Registers an animation and returns its name, `<label>-<hash>`, for `animation` or `animationName`.
   * It writes nothing and needs no engine, so a module can call it before `configure()`: the
   * `@keyframes` rule is written once, when a class that uses the name is first written. On React Native
   * it only returns the name.
   */
  keyframes(steps: KeyframesInput<T>, options?: KeyframesOptions): string
  /** Makes global styles (selectors and at-rules as keys) and returns their handle, for `Global`. It writes nothing and needs no engine. */
  globalStyles(styles: GlobalStylesInput<T>): GlobalStyles<T>
  /**
   * Writes global styles into the `global` layer while it is rendered, and renders nothing of its own.
   * In the browser the rules are removed when it unmounts, and replaced when its styles, or what they
   * read of the theme, change. On a server they are written for good, and sent as style elements where
   * the build sends them. Nothing on React Native.
   */
  Global(props: GlobalProps<T>): ReactElement | null
}

/** The styling for server components: the root theme of the request is read with readTheme, not with a hook. There is no context, and so no `ThemeContext`, `ThemeScope` or `useThemeClass`. */
export interface ServerStyle<T> extends Omit<
  WebStyle<T>,
  'useTheme' | 'ThemeContext' | 'ThemeScope' | 'useThemeClass'
> {
  /** The root theme of the request, or the base theme of the engine, or an empty object when there is neither. */
  readTheme(): T
}

export interface WebStyle<T> extends Omit<Style<T, SheetEntry>, 'ThemeProvider' | 'apply'> {
  /** The props that apply sheet entries (or class names) to a plain element: a class name. */
  apply(...entries: (SheetEntry | string | null | undefined | false)[]): { className?: string }
  ThemeProvider(props: WebThemeProviderProps<T>): ReactElement
  /**
   * Renders the wrapper of the nearest nested provider again (the same element and classes) around its
   * children, for content that a portal puts elsewhere in the document; under the outermost provider, or
   * none, its children alone.
   */
  ThemeScope(props: ThemeScopeProps): ReactElement
  /** The class string of the wrapper of the nearest nested provider, for an element of your own; undefined under the outermost provider, or none. */
  useThemeClass(): string | undefined
  /** The context that holds the real theme of the nearest provider (merged over the ones above); undefined with no provider above. */
  ThemeContext: Context<T | undefined>
  engine: Engine<T>
  cache: Cache
}
