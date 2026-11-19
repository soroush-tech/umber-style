import type {
  BindingOptions,
  ColorScheme,
  DeepPartial,
  SchemeKey,
  SchemeName,
  StylerOptions,
  ThemeKey,
} from '@umber-style/core'
import type {
  NativeObjectSheet,
  NativeSheetStyles,
  NativeStyleInput,
  NativeStyleObject,
} from './nativeStyle'
import type { platformStyleSheet } from './platform'
import type { ComponentProps, ElementType, FunctionComponent, ReactElement, ReactNode } from 'react'

/** The options of `createStyle`: the same as on the web, so one call runs on both; they are not used. */
export type StyleOptions<T = never> = BindingOptions<T>

export interface StyledOptions extends StylerOptions {
  /** Whether a prop is forwarded. Default: every prop but `as`, `theme` and `style`. */
  shouldForwardProp?: (prop: string) => boolean
}

/** What the `style` prop of a styled component takes: style objects (sheet entries are such objects), in arrays, with falsy values dropped. */
export type StyleProp = NativeStyleObject | false | null | undefined | readonly StyleProp[]

export type StyledComponent<C extends ElementType, P extends object> = FunctionComponent<
  Omit<ComponentProps<C>, keyof P | 'as' | 'style'> & P & { as?: ElementType; style?: StyleProp }
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
  /** The theme, or the part of it that this subtree changes. */
  readonly theme: DeepPartial<T>
  /** The color scheme of this subtree, for `whenScheme`: `light` or `dark`; `light dark` keeps the one above. */
  readonly colorScheme?: ColorScheme
  /** Ignored on React Native. */
  readonly className?: string
  /** Accepted and ignored: there are no classes on React Native, so the provider never renders an element. */
  readonly isRoot?: boolean
  readonly children?: ReactNode
}

export interface NativeStyle<T> {
  styled: Styled<T>
  /** The platform StyleSheet, with a `create` that registers the styles, and resolves them with the theme when they are a function of it. */
  StyleSheet: Omit<typeof platformStyleSheet, 'create'> & {
    /** A sheet given as an object is registered with the platform on first read and is its registered styles, usable at once, with no hook and no theme. */
    create<K extends string>(styles: NativeObjectSheet<K>): { readonly [P in K]: NativeStyleObject }
    /** A sheet given as a function of the theme is for `useStyle`, which resolves it against the theme. */
    create<K extends string>(
      styles: (theme: T) => Record<K, NativeStyleObject>
    ): SheetDefinition<Record<K, NativeStyleObject>, NativeStyleObject>
  }
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
  /** The real theme values, for JavaScript that needs a number or a name. */
  useTheme(): T
  /** Always '': there are no classes on React Native. */
  themeClass(theme: DeepPartial<T>, colorScheme?: ColorScheme): string
  /** A style key for "the nearest provider has this theme object" (compared by identity; `colorScheme` is not used here). */
  when(theme: DeepPartial<T>, colorScheme?: ColorScheme): ThemeKey
  /** A style key for "the nearest provider's `colorScheme` is this one"; with none above, the platform's color scheme. */
  whenScheme(scheme: SchemeName): SchemeKey
}
