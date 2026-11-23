import type {
  ComponentProps,
  Context,
  CSSProperties,
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
  LiveValue,
  ObjectSheet,
  SchemeKey,
  SchemeName,
  SerializedStyles,
  SheetEntry,
  SheetStyles,
  StaticTemplateValue,
  StyleInput,
  StylerOptions,
  StyleTypeOptions,
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
  LiveValue,
  NestedKey,
  SchemeKey,
  SchemeName,
  SheetEntry,
  StateKey,
  StateName,
  StyleObject,
  StyleTypeOptions,
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

/** The options of `createStyle(theme, options)`: those of the engine it makes, or the engine to use, and the server options. */
export interface StyleOptions<T = never> extends BindingOptions<T>, ServerStyleOptions {}

/** The options of `configure()`: those of `StyleOptions` for the engine of the default style, and its base theme. */
export interface DefaultStyleOptions extends BindingOptions<Theme>, ServerStyleOptions {
  /** The base theme, for an app that has no provider at all. */
  theme?: Theme
}

/**
 * The options of `styled(tag, options)`: the label of the class, which props reach the element, and a class
 * of your own. `_Props`, the props of the tag, changes nothing: it lets a wrapper of `styled` write
 * `StyledOptions<ComponentProps<C>>` next to `FilteringStyledOptions<ComponentProps<C>, Forwarded>`.
 */
export interface StyledOptions<_Props = unknown> extends StylerOptions {
  /**
   * Whether a prop is forwarded to the element or component that is rendered. It replaces the default,
   * which forwards to a string tag the attributes of HTML and SVG (by their React names), `data-*`,
   * `aria-*`, event handlers and React's own props, and every prop to a custom element (a tag with a
   * hyphen) and to a component. `theme`, `className` and `style` are the component's own and are never
   * forwarded, and so is `as` where it replaces what is rendered: `as` always replaces a string tag, and
   * replaces a component that is not made by `styled` only when this filter returns false for `as`;
   * without such a filter that component is rendered, and is given `as` as a prop.
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
> extends StyledOptions<Props> {
  /** A type guard of the props that are forwarded: the component takes only the props of the tag that it names. */
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
 * an error. By default it also takes React's `CSSProperties`, what the `style` of a plain element
 * takes, so props spread from `HTMLAttributes` fit; with `isStrict` in `StyleTypeOptions` it does not.
 */
export type StyleProp =
  | SheetEntry
  | WebStyleObject
  | ElementStyle
  | false
  | null
  | undefined
  | readonly StyleProp[]

/**
 * React's `CSSProperties` by default: an interface, which has no index signature and so is not a
 * `WebStyleObject` by itself. Nothing with the strict style types.
 */
type ElementStyle = StyleTypeOptions extends { isStrict: true } ? never : CSSProperties

/**
 * The `as` of a styled component whose tag takes the props `Base`: the type of the tag's own `as` when it
 * has one (a component that is not made by `styled` is given `as` as a prop, unless `shouldForwardProp`
 * keeps it off), else any element type.
 */
type AsProp<Base> = Base extends { as?: infer As }
  ? unknown extends As
    ? ElementType
    : As
  : ElementType

/**
 * The component's own props `P` without a `style` of theirs (props that extend `HTMLAttributes` have
 * one): the `style` of a styled component is `StyleProp`. Kept, `style` would be the intersection of
 * the two, a union of intersections that every element of the component is compared with.
 */
type OwnProps<P extends object> = 'style' extends keyof P ? Omit<P, 'style'> : P

// The props of the tag without those of the component's own props `P` are `Omit<Base, keyof P>` below
// (and `Omit<Base, keyof P | 'as' | 'style'>` for the element), written in a form that costs the compiler
// less. `Omit` filters every key of `Base` (the props of a tag are hundreds of keys) against `keyof P`,
// once for each `P`. Where `P` names no key of `Base`, the result keeps every key of `Base`, so it is the
// one type `Pick<Base, keyof Base>` (or `Omit<Base, 'as' | 'style'>`), made once for each `Base`; only
// where they share a key is `Omit` itself computed. The tests, in this order: `P` has no key; `P` has a
// key that is not a literal (an index or a pattern signature, whose matches `Omit` removes; only then
// does an empty object fit `Record<keyof P, unknown>`), so `Omit`; no key of `P` is a key of `Base`. The last is written `[keyof P] extends [Exclude<...>]`, so it is not
// decided while `P` is still a type parameter, where it would compute an `Omit` of that parameter for
// nothing. They are written in place, not as an alias of their own: the compiler did more work with one.

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
  ([keyof P] extends [never]
    ? Omit<Base, 'as' | 'style'>
    : [Record<never, never>] extends [Record<keyof P, unknown>]
      ? Omit<Base, keyof P | 'as' | 'style'>
      : [keyof P] extends [Exclude<keyof P, keyof Base>]
        ? Omit<Base, 'as' | 'style'>
        : Omit<Base, keyof P | 'as' | 'style'>) &
    OwnProps<P> & { as?: AsProp<Base>; style?: StyleProp }
> &
  StyledStatics

/** The props that a function style reads: the props of the tag `Base`, with the component's own `P` over them. */
type StyleFunctionProps<Base extends object, P extends object> = [keyof P] extends [never]
  ? Pick<Base, keyof Base> & P
  : [Record<never, never>] extends [Record<keyof P, unknown>]
    ? Omit<Base, keyof P> & P
    : [keyof P] extends [Exclude<keyof P, keyof Base>]
      ? Pick<Base, keyof Base> & P
      : Omit<Base, keyof P> & P

/** The props that the element of a styled component takes: those of the component, of the tag, and the ones only the element takes. */
type ElementProps<
  ComponentProps extends object,
  SpecificComponentProps extends object,
  JSXProps extends object,
> = ComponentProps & SpecificComponentProps & JSXProps

/**
 * What `styled(tag, options)` returns, in the form that a wrapper of `styled` names it: the props of the
 * component are `ComponentProps` and `SpecificComponentProps` (a wrapper puts its own, such as `theme`, in
 * the first, and the props of the tag in the second), and `JSXProps` are props that only the element takes
 * (`ref`). It takes the styles and makes the component, or is used as a tag, whose template is one style.
 * The props of the component's own are a type argument, `AdditionalProps`. A function style reads all of
 * them, the component's own over the others, and `theme`, the theme `T`.
 */
export interface CreateStyledComponent<
  ComponentProps extends object,
  SpecificComponentProps extends object = object,
  JSXProps extends object = object,
  T = Theme,
> {
  // Three forms, in this order. A function first: a function style whose parameters are annotated is
  // typed by the first form that sees it, and keeps its literal values only against a style. The
  // template. Then the styles, last, so that a mistake in a style object is reported against a style.
  <AdditionalProps extends object = object>(
    style: (
      props: StyleFunctionProps<ComponentProps & SpecificComponentProps, AdditionalProps> & {
        theme: T
      }
    ) => InterpolationResult,
    ...styles: Interpolation<
      StyleFunctionProps<ComponentProps & SpecificComponentProps, AdditionalProps>,
      T
    >[]
  ): StyledComponent<
    ElementType,
    AdditionalProps,
    ElementProps<ComponentProps, SpecificComponentProps, JSXProps>
  >
  // The props are not inferred from the values: a styled component among them is a selector, not a style.
  <AdditionalProps extends object = object>(
    template: TemplateStringsArray,
    ...values: TemplateValue<
      NoInfer<StyleFunctionProps<ComponentProps & SpecificComponentProps, AdditionalProps>>,
      T
    >[]
  ): StyledComponent<
    ElementType,
    AdditionalProps,
    ElementProps<ComponentProps, SpecificComponentProps, JSXProps>
  >
  <AdditionalProps extends object = object>(
    ...styles: Interpolation<
      StyleFunctionProps<ComponentProps & SpecificComponentProps, AdditionalProps>,
      T
    >[]
  ): StyledComponent<
    ElementType,
    AdditionalProps,
    ElementProps<ComponentProps, SpecificComponentProps, JSXProps>
  >
}

/**
 * What `styled(tag, options)` returns for the theme `T` and the tag `C`, whose props the component takes
 * (`Base`: all of them, unless a `shouldForwardProp` type guard named some): `CreateStyledComponent` with
 * the props of the tag.
 */
export type StyledFactory<
  T,
  C extends ElementType,
  Base extends object = ComponentProps<C>,
> = CreateStyledComponent<object, Base, object, T>

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

/** `styled` of a theme `T`: a call with a tag and options, and the shorthand of each tag. */
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

/**
 * What the `theme` of a provider of the theme `T` takes: `ThemeInput<T>`. The `Theme` of the default style
 * has no member of its own until an app declares its members in it, and until then no theme of the app
 * would match it (TypeScript rejects an object that shares no member with a type whose members are all
 * optional); so while it has none, the provider takes any theme object, or a function of the theme above
 * whose parameter the app types (`(outer: AppTheme) => AppTheme`).
 */
type ProviderThemeInput<T> = [Exclude<keyof T, '_theme'>] extends [never]
  ? object | UntypedThemeFunction['derive']
  : ThemeInput<T>

/**
 * The function form of `ProviderThemeInput` for a theme with no members: its parameter is compared both
 * ways, as a method's is, so a function whose parameter the app types as its own theme is taken.
 */
interface UntypedThemeFunction {
  derive(outer: object): object
}

/** The props of `ThemeProvider`: the theme of the subtree, and on the web its color scheme and wrapper. */
export interface ThemeProviderProps<T> {
  /**
   * The theme, or the part of it that this subtree changes; or a function of the theme above (the base
   * theme, or an empty object, for the outermost provider) that returns it. It is merged over the theme above.
   */
  readonly theme: ProviderThemeInput<T>
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
  /** The subtree that the theme applies to. */
  readonly children?: ReactNode
}

/** The props of `ThemeScope`. */
export interface ThemeScopeProps {
  /** The content to wrap in the wrapper of the nearest nested provider: what a portal renders elsewhere. */
  readonly children?: ReactNode
}

/** The props of `CacheProvider`. */
export interface CacheProviderProps {
  /** The cache of the subtree: one that `createCache` of `@umber-style/cache` (or of the core) made. */
  readonly value: Cache
  /** The subtree whose rules go to `value`. */
  readonly children?: ReactNode
}

/** The props of `Global`. */
export interface GlobalProps<T> {
  /**
   * The global styles: a handle that `globalStyles` made, a style object, a function of the theme, or a
   * list of them, written in the order of the list. A function of the theme reads the nearest provider:
   * tokens are references, raw keys (`breakpoints`) are its real values.
   */
  readonly styles: GlobalInput<T>
}

/** The props of `ThemeProvider` on the web: those of every platform, and the element of the wrapper. */
export interface WebThemeProviderProps<T> extends ThemeProviderProps<T> {
  /** The element of the wrapper of a nested provider. Default 'div'. */
  readonly as?: string
}

/**
 * What every platform's styling has, with `E` the entry of a sheet (a class name on the web, a style
 * object on React Native): the exports of the binding of the same names.
 */
export interface Style<T, E> {
  /** Makes a styled component from a tag or a component and its styles. */
  styled: Styled<T>
  /** Makes sheets: named styles, from an object or from a function of the theme. */
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
  /** Gives the subtree below it its theme, merged over the theme above. */
  ThemeProvider(props: ThemeProviderProps<T>): ReactElement
  /**
   * The real theme values, for JavaScript that needs a number or a name. In a client component: of the
   * nearest provider, else the base theme, else an empty object. In a server component (the server
   * components build): the base theme, the same in every render, else an empty object.
   */
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

/**
 * The styling for server components. `useTheme` is a plain function there, not a hook: it returns the base
 * theme. There is no context, and so no `ThemeContext`, `ThemeScope` or `useThemeClass`.
 */
export interface ServerStyle<T> extends Omit<
  WebStyle<T>,
  'useTheme' | 'ThemeContext' | 'ThemeScope' | 'useThemeClass'
> {
  /**
   * The base theme: the one given to `createStyle(theme)` or `configure({ theme })`, the same in every
   * render, whatever providers render; never the theme of a provider. With none, an empty object, and a
   * warning in development. A component that needs the nearest provider's values is a client component.
   */
  useTheme(): T
  /** Another name of `useTheme` in this build. */
  readTheme(): T
}

/** The setter of `useStyleValue`: a new number, or a function of the number before. */
export type StyleValueSetter = (next: number | ((previous: number) => number)) => void

/** The styling of the client build of the web binding: what `createStyle` returns, and the default style. */
export interface WebStyle<T> extends Omit<Style<T, SheetEntry>, 'ThemeProvider' | 'apply'> {
  /**
   * A number that a style reads through a CSS variable of its own, and its setter, as the state hook of React gives a
   * state: `const [left, setLeft] = useStyleValue(0, '%')`. In a style the value is the reference to the
   * variable (`${left}`, or an operand of `add`, `multiply` and the other helpers), so the class does
   * not change when the number does; `setLeft(next)` changes the declaration of the variable in place,
   * and renders nothing. `left.get()` is the number now. The number is written with `unit` after it,
   * or as it is without one. Its rule is on `:root`, in the theme layer, while the component is mounted;
   * the reference falls back to the first number, which a server render shows with no rule. In the
   * server components build the setter does nothing (a warning in development).
   */
  useStyleValue(initial: number, unit?: string): [LiveValue, StyleValueSetter]
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
  /** Gives the subtree below it its theme: the outermost one declares it on `:root`, a nested one renders a wrapper with its theme class. */
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
  /** The engine that writes the rules of this style. */
  engine: Engine<T>
  /** The cache of the engine, which holds the rules. */
  cache: Cache
}
