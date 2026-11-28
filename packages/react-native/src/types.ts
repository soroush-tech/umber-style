import type {
  BindingOptions,
  Cache,
  ColorScheme,
  DeepPartial,
  GlobalInput,
  GlobalStyles,
  GlobalStylesInput,
  KeyframesInput,
  KeyframesOptions,
  SchemeKey,
  SchemeName,
  StaticTemplateValue,
  StylerOptions,
  ThemedEntries,
  ThemedEntry,
  ThemeInput,
  ThemeKey,
} from '@umber-style/core'
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native'
import type {
  NativeObjectSheet,
  NativeSheetEntry,
  NativeSheetMark,
  NativeSheetStyles,
  NativeStyleInput,
  NativeStyleObject,
} from './nativeStyle'
import type { NativeTheme } from './nativeTheme'
import type { platformStyleSheet } from './platform'
import type {
  ComponentProps,
  ComponentPropsWithRef,
  ComponentType,
  Context,
  ElementType,
  FunctionComponent,
  ReactElement,
  ReactNode,
} from 'react'

/**
 * The options of `createStyle`: the same as on the web, so one call runs on both, and `remBase`. Only
 * `remBase` and `lengthKeys` are used: a theme value under one of `lengthKeys` (default `space`,
 * `sizes`, `radii`, `fontSizes`, `borderWidths`) that is a length in `px`, `rem` or no unit is a number.
 */
export interface StyleOptions<T = never> extends BindingOptions<T> {
  /** The font size, in density-independent pixels, that `1rem` is, in a theme and in a style. Default 16. */
  remBase?: number
  /**
   * `animated` of `@umber-style/react-native/animated`: the `animation*` and `transition*` keys of a style
   * then run, through the animation library that entry drives. Without it they are dropped, with a
   * development warning.
   */
  animated?: AnimatedDriver
}

/** What one styling needs to make its `Motion`: the base of `rem` and the base theme. */
export interface MotionContext {
  /** The font size that `1rem` is, for the lengths in the steps of an animation. */
  readonly remBase: number
  /** The base theme as it was given, for the steps of an animation that are a function of the theme. */
  readonly readTheme: () => object
}

/** How one styling runs animations: what `AnimatedDriver.bind` makes. */
export interface Motion {
  /**
   * Translates, in place, the animation and transition keys of one level of a style into what the
   * animation library takes: the shorthands expanded, a name of `keyframes` turned into its steps, times
   * and easings read. A value that cannot be read is dropped, with a development warning that names `name`.
   */
  translate(style: Record<string, unknown>, name: string | undefined): void
  /** `style` for a user who asked for less motion: no animation and no transition (see the docs). */
  reduce(style: NativeStyleObject): NativeStyleObject
  /** The animated form of `component` that the library makes, made once for each component. */
  wrap(component: ElementType): ElementType
}

/**
 * The value `animated` of `@umber-style/react-native/animated`, which `createStyle(theme, { animated })`
 * and `configure({ animated })` take. Its members are for the binding, not for an app.
 */
export interface AnimatedDriver {
  /** Makes the `Motion` of one styling. */
  bind(context: MotionContext): Motion
}

/** The options of `styled(tag, options)`: the label of the component, and which props reach the element. */
export interface StyledOptions extends StylerOptions {
  /** Whether a prop is forwarded. Default: every prop but `as`, `theme` and `style`. */
  shouldForwardProp?: (prop: string) => boolean
}

/**
 * What the `style` prop of a styled component takes: style objects (sheet entries are such objects) and
 * handles of a sheet made from a function of the theme (`sheet.card`), in arrays, with falsy values
 * dropped.
 */
type StyleValue = NativeStyleObject | ThemedEntry | false | null | readonly StyleProp[]
/** What the `style` prop of a styled component takes, or nothing. */
export type StyleProp = StyleValue | undefined

/**
 * What a `style` prop that takes sheet entries only takes, for a component whose style is of the kind
 * `S` (a `View` by default): an entry of the binding (of `StyleSheet.create` or `useStyle`, with the keys
 * of `S`), a handle of a sheet made from a function of the theme (`sheet.card`), `false`, `null`,
 * `undefined`, and lists of them, nested. A plain style object and a style of the platform's own
 * `StyleSheet.create` are type errors (they have no mark of the binding); `StyleProp` takes them.
 */
export type SheetStyleProp<S extends ViewStyle | TextStyle | ImageStyle = ViewStyle> =
  | (Pick<NativeStyleObject, keyof S & keyof NativeStyleObject> & NativeSheetMark)
  | ThemedEntry
  | false
  | null
  | undefined
  | readonly SheetStyleProp<S>[]

/**
 * The props that tell a styled component a state that its `state()` keys name, for a component that does
 * not report it itself (a `Pressable` reports `pressed`; hover and focus are kept from the events of a
 * component whose object styles name them). Where the styles name a state, the binding reads these and
 * does not forward them, unless `shouldForwardProp` returns true for the name.
 */
export interface StateProps {
  /** Whether it is pressed now. */
  pressed?: boolean
  /** Whether a pointer is over it now. */
  hovered?: boolean
  /** Whether it has the focus now. */
  focused?: boolean
}

/** A component made by `styled`: it takes the props of the tag, its own props `P`, the state props, `as` and `style`. */
export type StyledComponent<C extends ElementType, P extends object> = FunctionComponent<
  Omit<ComponentProps<C>, keyof P | 'as' | 'style'> &
    P &
    StateProps & { as?: ElementType; style?: StyleValue }
>

/** `styled` of a theme `T`: a tag and options, then the styles of the component. */
export type Styled<T> = <C extends ElementType>(
  tag: C,
  options?: StyledOptions
) => <P extends object = object>(...styles: NativeStyleInput<T, P>[]) => StyledComponent<C, P>

/** A set of named styles; `E` is what one of them becomes. */
export interface SheetDefinition<S extends NativeSheetStyles, E> {
  /** Never set at run time: it only carries the types. */
  readonly entries?: { [K in keyof S]: E }
}

/** The props of `ThemeProvider`: the theme of the subtree and its color scheme, and the props of the web that are ignored. */
export interface ThemeProviderProps<T> {
  /**
   * The theme, or the part of it that this subtree changes; or a function of the theme above (the base
   * theme, or an empty object, for the outermost provider) that returns it. It is merged over the theme above.
   */
  readonly theme: ThemeInput<T>
  /** The color scheme of this subtree, for `whenScheme`: `light` or `dark`; `light dark` keeps the one above. */
  readonly colorScheme?: ColorScheme
  /** Ignored on React Native. */
  readonly className?: string
  /** Accepted and ignored: there are no classes on React Native, so the provider never renders an element. */
  readonly isRoot?: boolean
  /** The subtree that the theme applies to. */
  readonly children?: ReactNode
}

/** The props of `CacheProvider`: the same as on the web, so that one source compiles for both. */
export interface CacheProviderProps {
  /** A cache of the web engine: React Native writes no CSS, so it is not read. */
  readonly value: Cache
  /** What it renders, as it is. */
  readonly children?: ReactNode
}

/** The props of `ThemeScope`: the same as on the web, so one source runs on both. */
export interface ThemeScopeProps {
  /** What it renders, as it is. */
  readonly children?: ReactNode
}

/** The props of `Global`: the same as on the web, so one source runs on both; they are not used. */
export interface GlobalProps<T> {
  /** The global styles of the web: accepted, and nothing is written. */
  readonly styles: GlobalInput<T>
}

/** What `css()` takes on React Native: native style objects, nothing, and lists of them. */
export type NativeCssArgument =
  | NativeStyleObject
  | null
  | undefined
  | false
  | readonly NativeCssArgument[]

/** `css()` on React Native: one native style, from styles or from a tagged template. */
export interface NativeCssFunction {
  // The styles last, so that a mistake in a style object is reported against a style.
  (template: TemplateStringsArray, ...values: StaticTemplateValue[]): NativeStyleObject
  (...styles: NativeCssArgument[]): NativeStyleObject
}

/** The platform StyleSheet, with a `create` that registers the styles, and resolves them with the theme when they are a function of it. */
export type NativeStyleSheet<T> = Omit<typeof platformStyleSheet, 'create'> & {
  /** A sheet given as an object is registered with the platform on first read and is its registered styles, usable at once, with no hook and no theme. */
  create<K extends string>(styles: NativeObjectSheet<K>): { readonly [P in K]: NativeSheetEntry }
  /**
   * A sheet given as a function of the theme: `useStyle` resolves it against the theme, and each name is
   * a handle (`sheet.card`) that the `style` of a styled component resolves with its own theme.
   */
  create<K extends string>(
    styles: (theme: T) => Record<K, NativeStyleObject>
  ): SheetDefinition<Record<K, NativeStyleObject>, NativeSheetEntry> &
    ThemedEntries<K, 'resolve' | 'prepare'>
}

/**
 * The props `P` of a component, with the prop `Name` replaced by `Value` where it does not take `Value`:
 * a component is one that `withTheme` or `withStyle` takes when its props are these, so a component whose
 * `theme` (or `styles`) is of another type is a type error.
 */
export type PropsTaking<P, Name extends string, Value> = {
  [K in keyof P]: K extends Name ? (Value extends P[K] ? P[K] : Value) : P[K]
}

/** The statics that a wrapper of `withTheme` or `withStyle` does not take from the component it wraps. */
type OwnStatics =
  | 'childContextTypes'
  | 'contextType'
  | 'contextTypes'
  | 'defaultProps'
  | 'displayName'
  | 'getDerivedStateFromError'
  | 'getDerivedStateFromProps'
  | 'propTypes'
  | 'prototype'

/**
 * A component that `withTheme` or `withStyle` made from the component `C`: it takes the props of `C` and
 * its `ref` (the instance of a class component), without `Name` (`theme` or `styles`), which it gives
 * itself, and it has the statics of `C` that are not React's.
 */
export type WrappedComponent<C extends ElementType, Name extends string> = FunctionComponent<
  Omit<ComponentPropsWithRef<C>, Name>
> &
  Omit<C, OwnStatics>

/**
 * What `withStyle(sheet)` returns: it wraps a component whose `styles` prop takes `Styles`, the entries
 * that `useStyle(sheet)` returns.
 */
export type StyleWrapper<Styles> = <
  C extends ComponentType<PropsTaking<ComponentProps<C>, 'styles', Styles>>,
>(
  component: C
) => WrappedComponent<C, 'styles'>

/**
 * The styling of the theme shape `T` on React Native. What reads the theme (`useTheme`, a style function,
 * a sheet made from a function, `ThemeContext`) gets it as React Native holds it, `NativeTheme<T>`:
 * lengths are numbers. What takes a theme (`ThemeProvider`, `when`) takes `T`.
 */
export interface NativeStyle<T> {
  /** Makes a styled component from a component and its styles. */
  styled: Styled<NativeTheme<T>>
  /** The platform StyleSheet, whose `create` also takes a function of the theme. */
  StyleSheet: NativeStyleSheet<NativeTheme<T>>
  /** The styles of a sheet; an object sheet is its own registered styles and is returned as it is. */
  useStyle<K extends string>(sheet: { readonly [P in K]: NativeSheetEntry }): {
    readonly [P in K]: NativeSheetEntry
  }
  useStyle<K extends string>(
    sheet: SheetDefinition<Record<K, NativeStyleObject>, NativeSheetEntry> &
      ThemedEntries<K, 'resolve' | 'prepare'>
  ): { [P in K]: NativeSheetEntry }
  useStyle<S extends NativeSheetStyles>(
    sheet: SheetDefinition<S, NativeSheetEntry>
  ): {
    [K in keyof S]: NativeSheetEntry
  }
  /**
   * Wraps a component, a class component too, so that it renders with `styles` set to `useStyle(sheet)`,
   * read in the wrapper's render: it follows the providers, the window and the color scheme as the hook
   * does. The sheet is made once, at module level. The wrapper takes the props of the component without
   * `styles`, forwards `ref`, keeps the statics and is named `withStyle(Card)`.
   */
  withStyle<K extends string>(sheet: {
    readonly [P in K]: NativeSheetEntry
  }): StyleWrapper<{ readonly [P in K]: NativeSheetEntry }>
  withStyle<K extends string>(
    sheet: SheetDefinition<Record<K, NativeStyleObject>, NativeSheetEntry> &
      ThemedEntries<K, 'resolve' | 'prepare'>
  ): StyleWrapper<{ [P in K]: NativeSheetEntry }>
  withStyle<S extends NativeSheetStyles>(
    sheet: SheetDefinition<S, NativeSheetEntry>
  ): StyleWrapper<{ [K in keyof S]: NativeSheetEntry }>
  /** The props that apply entries of a sheet: a style array. */
  apply(...entries: (NativeStyleObject | null | undefined | false)[]): {
    style: NativeStyleObject[]
  }
  /**
   * One style made once and passed around: native styles merged in order, the last key winning, each
   * turned into a native style as a sheet entry is (lengths in `px` and `rem` are numbers, web-only keys
   * are dropped); or, as a tag, the template read as CSS text and turned the same way. It returns the
   * native style, for `style`. A function is a `TypeError`: there are no props.
   */
  css: NativeCssFunction
  /** Gives the subtree below it its theme, merged over the theme above; it renders no element. */
  ThemeProvider(props: ThemeProviderProps<T>): ReactElement
  /** Renders its children: there is no wrapper to repeat, and a modal stays inside the tree, under the providers above it. It exists so that one source runs on both. */
  ThemeScope(props: ThemeScopeProps): ReactElement
  /** Always undefined: there are no classes on React Native. */
  useThemeClass(): string | undefined
  /** The context that holds the real theme of the nearest provider (merged over the ones above, lengths as numbers); undefined with no provider above. */
  ThemeContext: Context<NativeTheme<T> | undefined>
  /** The real theme values, for JavaScript that needs a number or a name: of the nearest provider, else the base theme, else an empty object. Lengths are numbers. */
  useTheme(): NativeTheme<T>
  /**
   * Wraps a component, a class component too, so that it renders with `theme` set to `useTheme()`, read
   * in the wrapper's render. The wrapper takes the props of the component without `theme`, forwards
   * `ref`, keeps the statics and is named `withTheme(Card)`.
   */
  withTheme<C extends ComponentType<PropsTaking<ComponentProps<C>, 'theme', NativeTheme<T>>>>(
    component: C
  ): WrappedComponent<C, 'theme'>
  /** Always '': there are no classes on React Native. */
  themeClass(theme: DeepPartial<T>, colorScheme?: ColorScheme): string
  /** A style key for "the nearest provider has this theme object" (compared by identity; `colorScheme` is not used here). */
  when(theme: DeepPartial<T>, colorScheme?: ColorScheme): ThemeKey
  /** A style key for "the nearest provider's `colorScheme` is this one"; with none above, the platform's color scheme. */
  whenScheme(scheme: SchemeName): SchemeKey
  /** The name of an animation, as on the web, so one source runs on both. It runs with the `animated` option; without it the `animation*` and `transition*` keys are dropped from a style. */
  keyframes(steps: KeyframesInput<T>, options?: KeyframesOptions): string
  /** A handle of global styles, as on the web; React Native has no global styles, and `Global` does nothing with it. */
  globalStyles(styles: GlobalStylesInput<T>): GlobalStyles<T>
  /** Renders nothing and does nothing: React Native has no global styles. It exists so that one source runs on both. */
  Global(props: GlobalProps<T>): ReactElement | null
}
