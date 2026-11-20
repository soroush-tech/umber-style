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
  CssArgument,
  DeepPartial,
  Engine,
  GlobalInput,
  GlobalStyleObject,
  GlobalStyles,
  GlobalStylesInput,
  Interpolation as CoreInterpolation,
  InterpolationResult,
  Keyframes,
  KeyframesInput,
  KeyframesOptions,
  KeyframesSteps,
  ObjectSheet,
  SchemeKey,
  SchemeName,
  SerializedStyles,
  SheetEntry,
  SheetStyles,
  StaticTemplateValue,
  StyleInput,
  StylerOptions,
  TemplateValue,
  Theme as CoreTheme,
  ThemeInput,
  ThemeKey,
  WebStyleObject,
} from '@umber-style/core'

/** The style types of the core that an app annotates with or uses `satisfies` with. */
export type {
  AlphaColor,
  ComponentSelector,
  CSSObject,
  CssArgument,
  InterpolationResult,
  Keyframes,
  SerializedStyles,
  StaticTemplateValue,
  TemplateValue,
  UmberCache,
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

/**
 * The theme of the default style of this binding: what `styled`, `useTheme`, `StyleSheet` and
 * `ThemeProvider` of the default style read. It extends the core's `Theme`, so an app gives it members
 * from either module: `declare module '@umber-style/react' { interface Theme extends MyTheme {} }` for
 * React alone, or `declare module '@umber-style/core'` for a theme that every binding shares. The
 * optional member below only keeps it from being empty.
 */
export interface Theme extends CoreTheme {
  readonly _theme?: never
}

/**
 * A style in any form that `styled` takes: a style object, a `css()` result or a sheet entry, a function
 * of the props and the theme, nothing, or a list of them. The core's `Interpolation`, with this binding's
 * `Theme` unless another is given.
 */
export type Interpolation<Props = unknown, T = Theme> = CoreInterpolation<Props, T>

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

/**
 * `StyledOptions` whose `shouldForwardProp` is a type guard: the props of the tag that a styled component
 * then takes are only the ones it names, `Forwarded`.
 */
export interface FilteringStyledOptions<
  Props = Record<string, unknown>,
  Forwarded extends keyof Props & string = keyof Props & string,
> extends StyledOptions {
  shouldForwardProp?: (prop: string) => prop is Forwarded
}

/** The props of a component or a tag, as an element of it takes them. */
export type PropsOf<C extends ElementType> = JSX.LibraryManagedAttributes<C, ComponentProps<C>>

/** What a styled component keeps, so that styling it again flattens into one element. */
export interface StyledStatics {
  /** Every style of the component, the styles of the components it wraps first. */
  _styles: readonly StyleInput[]
  /** The tag or component that is finally rendered. */
  _tag: ElementType
  _shouldForwardProp?: (prop: string) => boolean
  /** The `target` classes of the component and of the components it wraps. */
  _target?: string
  /** The component as a selector: `.` and a class that every element of it has. Throws when it has none. */
  toString(): string
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

/**
 * A component made by `styled`: it takes the props of the tag (`Base`: all of them, unless a
 * `shouldForwardProp` type guard named some), its own props `P`, `as` and `style`. As text it is a
 * selector: `.` and a class that every element of it has (its `target`, else its class when none of its
 * styles is a function).
 */
export type StyledComponent<
  C extends ElementType,
  P extends object,
  Base extends object = ComponentProps<C>,
> = FunctionComponent<
  Omit<Base, keyof P | 'as' | 'style'> & P & { as?: ElementType; style?: StyleProp }
> &
  StyledStatics

/**
 * What `styled(tag, options)` returns: it takes the styles and makes the component, or is used as a tag,
 * whose template is one style (a function of the props when an interpolation is a function).
 */
export interface StyledFactory<T, C extends ElementType, Base extends object = ComponentProps<C>> {
  // Three forms, in this order. A function first: a function style whose parameters are annotated is
  // typed by the first form that sees it, and keeps its literal values only against a style. The
  // template. Then the styles, last, so that a mistake in a style object is reported against a style.
  <P extends object = object>(
    style: (props: P & { theme: T }) => InterpolationResult,
    ...styles: Interpolation<P, T>[]
  ): StyledComponent<C, P, Base>
  // `P` is not inferred from the values: a styled component among them is a selector, not a style.
  <P extends object = object>(
    template: TemplateStringsArray,
    ...values: TemplateValue<NoInfer<P>, T>[]
  ): StyledComponent<C, P, Base>
  <P extends object = object>(...styles: Interpolation<P, T>[]): StyledComponent<C, P, Base>
}

/** The shorthand of each HTML and SVG tag: `styled.div(...styles)` is `styled('div')(...styles)`. */
export type StyledTags<T> = {
  readonly [K in keyof JSX.IntrinsicElements]: StyledFactory<T, K>
}

/** `styled(tag, options)`: with a `shouldForwardProp` type guard, the component takes only the props of `tag` that it names. */
export interface StyledCall<T> {
  <C extends ElementType, Forwarded extends keyof ComponentProps<C> & string>(
    tag: C,
    options: FilteringStyledOptions<ComponentProps<C>, Forwarded> & {
      shouldForwardProp: (prop: string) => prop is Forwarded
    }
  ): StyledFactory<T, C, Pick<ComponentProps<C>, Forwarded>>
  <C extends ElementType>(tag: C, options?: StyledOptions): StyledFactory<T, C>
}

export type Styled<T> = StyledCall<T> & StyledTags<T>

/** The type of `styled` itself, with the tag shorthands: `Styled` of this binding's `Theme` unless another is given. */
export type CreateStyled<T = Theme> = Styled<T>

/** `css()`: one style made once and passed around, from styles or from a tagged template. */
export interface CssFunction {
  // The styles last, so that a mistake in a style object is reported against a style.
  (template: TemplateStringsArray, ...values: StaticTemplateValue[]): SerializedStyles
  (...styles: CssArgument[]): SerializedStyles
}

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

/** The props of `CacheProvider`. */
export interface CacheProviderProps {
  /** The cache of the subtree: one that `createCache` of `@umber-style/cache` (or of the core) made. */
  readonly value: Cache
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
  keyframes(steps: (theme: T) => KeyframesSteps, options?: KeyframesOptions): Keyframes
  /** As a tag: the steps written as CSS text (`from { ... } to { ... }`); a function among the interpolations is called with `{ theme }`. */
  keyframes(template: TemplateStringsArray, ...values: TemplateValue<unknown, T>[]): Keyframes
  keyframes(steps: KeyframesInput<T>, options?: KeyframesOptions): Keyframes
  /** Makes global styles (selectors and at-rules as keys) and returns their handle, for `Global`. It writes nothing and needs no engine. */
  globalStyles(styles: (theme: T) => GlobalStyleObject): GlobalStyles<T>
  /** As a tag: the styles written as CSS text (`body { margin: 0; }`); a function among the interpolations is called with `{ theme }`. */
  globalStyles(
    template: TemplateStringsArray,
    ...values: TemplateValue<unknown, T>[]
  ): GlobalStyles<T>
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
  /**
   * One style made once and passed around: style objects, `css()` results and sheet entries (lists too,
   * falsy values dropped) merged in order, the last winning; or, as a tag, the template read as CSS text.
   * It returns a sheet entry: its text is its class name, and it goes in the `style` prop of a styled
   * component, in `apply`, in another `css()`, among the styles of `styled` and under a selector of
   * global styles. Equal styles give the same class. A function is a `TypeError`: there are no props.
   */
  css: CssFunction
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
