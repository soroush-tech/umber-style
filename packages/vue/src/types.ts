import type { Component, ComputedRef, FunctionalComponent, IntrinsicElementAttributes } from 'vue'
import type {
  BindingOptions,
  ColorScheme,
  CssArgument,
  Engine,
  GlobalInput,
  GlobalStyles,
  GlobalStyleObject,
  GlobalStylesInput,
  Interpolation as CoreInterpolation,
  InterpolationResult,
  Keyframes,
  KeyframesInput,
  KeyframesOptions,
  KeyframesSteps,
  ObjectSheet,
  SerializedStyles,
  SheetEntry,
  SheetStyles,
  StaticTemplateValue,
  StyleInput,
  StylerOptions,
  TemplateValue,
  Theme as CoreTheme,
  ThemeInput,
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

/**
 * The theme of the default style of this binding: what `styled`, `useTheme`, `StyleSheet` and
 * `ThemeProvider` of the default style read. It extends the core's `Theme`, so an app gives it members
 * from either module: `declare module '@umber-style/vue' { interface Theme extends MyTheme {} }` for Vue
 * alone, or `declare module '@umber-style/core'` for a theme that every binding shares. The optional
 * member below only keeps it from being empty.
 */
export interface Theme extends CoreTheme {
  readonly _theme?: never
}

/**
 * A style in any form that `styled` takes: a style object, a `css()` result or a sheet entry, a function
 * of the attributes and the theme, nothing, or a list of them. The core's `Interpolation`, with this
 * binding's `Theme` unless another is given.
 */
export type Interpolation<Props = Record<string, unknown>, T = Theme> = CoreInterpolation<Props, T>

/** The options of `createStyle`: the engine options of the core, or an engine to bind. */
export type StyleOptions<T = never> = BindingOptions<T>

/** The options of `styled(tag, options)`: the label of the class, what reaches the element, a class name of your own. */
export interface StyledOptions extends StylerOptions {
  /** Whether an attribute is forwarded to a string tag. Default: every attribute but `as`, `theme`, `class` and `style`, which the component handles itself; a component that is not made by `styled` is always rendered, and is given `as`. */
  shouldForwardProp?: (prop: string) => boolean
  /**
   * A class name of your own that the element always has, after the engine's classes: a stable name
   * that a parent's selector or a test can find. It is not a style and has no rule. A component that
   * wraps this one keeps it, and adds its own.
   */
  target?: string
}

/**
 * `StyledOptions` whose `shouldForwardProp` is a type guard. A Vue styled component takes any attribute,
 * so it only types the guard; the attributes that are forwarded are the ones it names.
 */
export interface FilteringStyledOptions<
  Props = Record<string, unknown>,
  Forwarded extends keyof Props & string = keyof Props & string,
> extends StyledOptions {
  /** Whether an attribute is forwarded to a string tag, as a type guard over the names it forwards. */
  shouldForwardProp?: (prop: string) => prop is Forwarded
}

/** The props of a component or a tag: what its instances declare, or the attributes of an element. */
export type PropsOf<C> = C extends keyof IntrinsicElementAttributes
  ? IntrinsicElementAttributes[C]
  : C extends new (...args: never[]) => { $props: infer P }
    ? P
    : C extends FunctionalComponent<infer P>
      ? P
      : Record<string, unknown>

/** What a styled component keeps, so that styling it again flattens into one element. */
export interface StyledStatics {
  /** Every style of the component, the styles of the components it wraps first. */
  _styles: readonly StyleInput[]
  /** The tag or component that is finally rendered. */
  _tag: string | Component
  _shouldForwardProp?: (prop: string) => boolean
  /** The `target` classes of the component and of the components it wraps. */
  _target?: string
  /** The component as a selector: `.` and a class that every element of it has. Throws when it has none. */
  toString(): string
}

/** A component that `styled` made: it takes any attribute, and keeps its styles for a component that wraps it. */
export type StyledComponent = FunctionalComponent<Record<string, unknown>> & StyledStatics

/**
 * What `styled(tag, options)` returns: it takes the styles and makes the component, or is used as a tag,
 * whose template is one style (a function of the attributes when an interpolation is a function).
 */
export interface StyledFactory<T> {
  // Three forms, in this order. A function first: a function style whose parameters are annotated is
  // typed by the first form that sees it, and keeps its literal values only against a style. The
  // template. Then the styles, last, so that a mistake in a style object is reported against a style.
  (
    style: (props: Record<string, unknown> & { theme: T }) => InterpolationResult,
    ...styles: Interpolation<Record<string, unknown>, T>[]
  ): StyledComponent
  (
    template: TemplateStringsArray,
    ...values: TemplateValue<Record<string, unknown>, T>[]
  ): StyledComponent
  (...styles: Interpolation<Record<string, unknown>, T>[]): StyledComponent
}

/** The shorthand of each HTML and SVG tag: `styled.div(...styles)` is `styled('div')(...styles)`. */
export type StyledTags<T> = { readonly [K in keyof IntrinsicElementAttributes]: StyledFactory<T> }

/** `styled` over the theme `T`: a function of a tag or a component and its options, with the tag shorthands. */
export type Styled<T> = ((tag: string | Component, options?: StyledOptions) => StyledFactory<T>) &
  StyledTags<T>

/** The type of `styled` itself, with the tag shorthands: `Styled` of this binding's `Theme` unless another is given. */
export type CreateStyled<T = Theme> = Styled<T>

/** `css()`: one style made once and passed around, from styles or from a tagged template. */
export interface CssFunction {
  // The styles last, so that a mistake in a style object is reported against a style.
  (template: TemplateStringsArray, ...values: StaticTemplateValue[]): SerializedStyles
  (...styles: CssArgument[]): SerializedStyles
}

/** A set of named styles made from a function of the theme: it has no entries until `useStyle` resolves it. */
export interface Sheet<S extends SheetStyles> {
  /** The entries of the sheet for a theme view, which `useStyle` passes. */
  resolve(theme?: unknown): { [K in keyof S]: SheetEntry }
}

/** The props of `ThemeProvider`. */
export interface ThemeProviderProps<T> {
  /**
   * The theme, or the part of it that this subtree changes; or a function of the theme above (the base
   * theme, or an empty object, for the outermost provider) that returns it. It is merged over the theme above.
   */
  theme: ThemeInput<T>
  /** The color scheme of this subtree, which `whenScheme()` matches and the theme class carries. Default: none, the system preference. */
  colorScheme?: ColorScheme
  /** The element of the wrapper of a nested provider. Default 'div'. */
  as?: string
  /**
   * Renders no element, no class and no rule: the app puts `themeClass(theme)` on an ancestor, usually
   * `<html>`. Without it the outermost provider declares its theme on `:root`, and renders no element either.
   */
  isRoot?: boolean
}

/** The props of `Global`. */
export interface GlobalProps<T> {
  /**
   * The global styles: a handle that `globalStyles` made, a style object, a function of the theme, or a
   * list of them, written in the order of the list. A function of the theme reads the nearest provider:
   * tokens are references, raw keys (`breakpoints`) are its real values.
   */
  styles: GlobalInput<T>
}

/** What `createStyle` and `bindEngine` return: the Vue styling of one engine. */
export interface Style<T> {
  /** The engine every member writes through. */
  engine: Engine<T>
  /** The cache of the engine: its rules and sheet. */
  cache: Engine<T>['cache']
  /** Makes a styled component of a tag or a component; `styled.div` and the other tag shorthands too. */
  styled: Styled<T>
  /** Makes sheets of named styles. */
  StyleSheet: {
    /** A sheet given as an object is its entries, usable at once, with no hook and no theme. */
    create<K extends string>(styles: ObjectSheet<K>): { readonly [P in K]: SheetEntry }
    /** A sheet given as a function of the theme is for `useStyle`, which resolves it against the theme. */
    create<K extends string>(
      styles: (theme: T) => Record<K, WebStyleObject>
    ): Sheet<Record<K, WebStyleObject>>
  }
  /** The entries of a sheet; an object sheet is its own entries and is returned as it is. */
  useStyle<K extends string>(sheet: { readonly [P in K]: SheetEntry }): {
    readonly [P in K]: SheetEntry
  }
  /** The entries of a sheet made from a function of the theme, resolved against the nearest provider. Call it in `setup`. */
  useStyle<S extends SheetStyles>(sheet: Sheet<S>): { [K in keyof S]: SheetEntry }
  /** The attributes that apply entries of a sheet: a class. */
  apply(...entries: (SheetEntry | string | null | undefined | false)[]): { class?: string }
  /**
   * One style made once and passed around: style objects, `css()` results and sheet entries (lists too,
   * falsy values dropped) merged in order, the last winning; or, as a tag, the template read as CSS text.
   * It returns a sheet entry: its text is its class name, and it goes in the `style` attribute of a styled
   * component, in `apply`, in another `css()`, among the styles of `styled` and under a selector of
   * global styles. Equal styles give the same class. A function is a `TypeError`: there are no props.
   */
  css: CssFunction
  /** Gives its slot a theme, merged over the theme above: the outermost one on `:root`, a nested one on its wrapper. */
  ThemeProvider: Component<ThemeProviderProps<T>>
  /**
   * Renders the wrapper of the nearest nested provider again (the same element and classes) around its
   * slot, for content that a teleport puts elsewhere in the document; under the outermost provider, or
   * none, the slot alone.
   */
  ThemeScope: Component
  /** The real theme values, merged over the providers above; reactive. With no provider, the base theme, or an empty object. Call it in `setup`. */
  useTheme(): ComputedRef<T>
  /** The class string of the wrapper of the nearest nested provider, reactive; undefined under the outermost provider, or none. Call it in `setup`. */
  useThemeClass(): ComputedRef<string | undefined>
  /** The class string of a theme (and a color scheme), for an element the app renders itself, such as `<html>`. */
  themeClass: Engine<T>['themeClass']
  /** A style key for "the nearest theme is this theme"; it needs `@scope`. */
  when: Engine<T>['when']
  /** A style key for "the nearest color scheme is this one": the nearest theme given that `colorScheme`, else the system preference. */
  whenScheme: Engine<T>['whenScheme']
  /**
   * Registers an animation and returns its name, `<label>-<hash>`, for `animation` or `animationName`.
   * It writes nothing and needs no engine, so a module can call it before `configure()`: the
   * `@keyframes` rule is written once, when a class that uses the name is first written.
   */
  keyframes(steps: (theme: T) => KeyframesSteps, options?: KeyframesOptions): Keyframes
  /** As a tag: the steps written as CSS text (`from { ... } to { ... }`); a function among the interpolations is called with `{ theme }`. */
  keyframes(template: TemplateStringsArray, ...values: TemplateValue<unknown, T>[]): Keyframes
  /** The steps as an object, or a function of the theme. */
  keyframes(steps: KeyframesInput<T>, options?: KeyframesOptions): Keyframes
  /** Makes global styles (selectors and at-rules as keys) and returns their handle, for `Global`. It writes nothing and needs no engine. */
  globalStyles(styles: (theme: T) => GlobalStyleObject): GlobalStyles<T>
  /** As a tag: the styles written as CSS text (`body { margin: 0; }`); a function among the interpolations is called with `{ theme }`. */
  globalStyles(
    template: TemplateStringsArray,
    ...values: TemplateValue<unknown, T>[]
  ): GlobalStyles<T>
  /** The styles as an object, or a function of the theme. */
  globalStyles(styles: GlobalStylesInput<T>): GlobalStyles<T>
  /**
   * Writes global styles into the `global` layer while it is mounted, and renders nothing. In the browser
   * the rules are removed when it unmounts, and replaced when its styles, or what they read of the theme,
   * change. On a server they are written for good, for `extractPageStyles`.
   */
  Global: Component<GlobalProps<T>>
}
