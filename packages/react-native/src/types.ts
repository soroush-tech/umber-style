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
  ThemeInput,
  ThemeKey,
} from '@umber-style/core'
import type {
  NativeObjectSheet,
  NativeSheetStyles,
  NativeStyleInput,
  NativeStyleObject,
} from './nativeStyle'
import type { NativeTheme } from './nativeTheme'
import type { platformStyleSheet } from './platform'
import type {
  ComponentProps,
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
}

/** The options of `styled(tag, options)`: the label of the component, and which props reach the element. */
export interface StyledOptions extends StylerOptions {
  /** Whether a prop is forwarded. Default: every prop but `as`, `theme` and `style`. */
  shouldForwardProp?: (prop: string) => boolean
}

/** What the `style` prop of a styled component takes: style objects (sheet entries are such objects), in arrays, with falsy values dropped. */
type StyleValue = NativeStyleObject | false | null | readonly StyleProp[]
/** What the `style` prop of a styled component takes, or nothing. */
export type StyleProp = StyleValue | undefined

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
  create<K extends string>(styles: NativeObjectSheet<K>): { readonly [P in K]: NativeStyleObject }
  /** A sheet given as a function of the theme is for `useStyle`, which resolves it against the theme. */
  create<K extends string>(
    styles: (theme: T) => Record<K, NativeStyleObject>
  ): SheetDefinition<Record<K, NativeStyleObject>, NativeStyleObject>
}

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
  useStyle<K extends string>(sheet: { readonly [P in K]: NativeStyleObject }): {
    readonly [P in K]: NativeStyleObject
  }
  useStyle<S extends NativeSheetStyles>(
    sheet: SheetDefinition<S, NativeStyleObject>
  ): {
    [K in keyof S]: NativeStyleObject
  }
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
  /** Always '': there are no classes on React Native. */
  themeClass(theme: DeepPartial<T>, colorScheme?: ColorScheme): string
  /** A style key for "the nearest provider has this theme object" (compared by identity; `colorScheme` is not used here). */
  when(theme: DeepPartial<T>, colorScheme?: ColorScheme): ThemeKey
  /** A style key for "the nearest provider's `colorScheme` is this one"; with none above, the platform's color scheme. */
  whenScheme(scheme: SchemeName): SchemeKey
  /** The name of an animation, as on the web, so one source runs on both. Nothing runs it on React Native: the `animation*` and `transition*` keys are dropped from a style. */
  keyframes(steps: KeyframesInput<T>, options?: KeyframesOptions): string
  /** A handle of global styles, as on the web; React Native has no global styles, and `Global` does nothing with it. */
  globalStyles(styles: GlobalStylesInput<T>): GlobalStyles<T>
  /** Renders nothing and does nothing: React Native has no global styles. It exists so that one source runs on both. */
  Global(props: GlobalProps<T>): ReactElement | null
}
