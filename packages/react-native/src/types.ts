import type {
  BindingOptions,
  ColorScheme,
  DeepPartial,
  GlobalInput,
  GlobalStyles,
  GlobalStylesInput,
  KeyframesInput,
  KeyframesOptions,
  SchemeKey,
  SchemeName,
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

export interface StyledOptions extends StylerOptions {
  /** Whether a prop is forwarded. Default: every prop but `as`, `theme` and `style`. */
  shouldForwardProp?: (prop: string) => boolean
}

/** What the `style` prop of a styled component takes: style objects (sheet entries are such objects), in arrays, with falsy values dropped. */
type StyleValue = NativeStyleObject | false | null | readonly StyleProp[]
export type StyleProp = StyleValue | undefined

export type StyledComponent<C extends ElementType, P extends object> = FunctionComponent<
  Omit<ComponentProps<C>, keyof P | 'as' | 'style'> & P & { as?: ElementType; style?: StyleValue }
>

export type Styled<T> = <C extends ElementType>(
  tag: C,
  options?: StyledOptions
) => <P extends object = object>(...styles: NativeStyleInput<T, P>[]) => StyledComponent<C, P>

/** A set of named styles; `E` is what one of them becomes. */
export interface SheetDefinition<S extends NativeSheetStyles, E> {
  /** Never set at run time: it only carries the types. */
  readonly entries?: { [K in keyof S]: E }
}

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
  readonly children?: ReactNode
}

/** The props of `ThemeScope`: the same as on the web, so one source runs on both. */
export interface ThemeScopeProps {
  readonly children?: ReactNode
}

/** The props of `Global`: the same as on the web, so one source runs on both; they are not used. */
export interface GlobalProps<T> {
  readonly styles: GlobalInput<T>
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
  styled: Styled<NativeTheme<T>>
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
