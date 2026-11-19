import type {
  BindingOptions,
  ColorScheme,
  DeepPartial,
  SheetStyles,
  StyleInput,
  StyleObject,
  StylerOptions,
} from '@umber-style/core'
import type { platformStyleSheet } from './platform'
import type { ComponentProps, ElementType, FunctionComponent, ReactElement, ReactNode } from 'react'

/** The options of `createStyle`: the same as on the web, so one call runs on both; they are not used. */
export type StyleOptions<T = never> = BindingOptions<T>

export interface StyledOptions extends StylerOptions {
  /** Whether a prop is forwarded. Default: every prop but `as`, `theme` and `style`. */
  shouldForwardProp?: (prop: string) => boolean
}

/** What the `style` prop of a styled component takes: style objects (sheet entries are such objects), in arrays, with falsy values dropped. */
export type StyleProp = StyleObject | false | null | undefined | readonly StyleProp[]

export type StyledComponent<C extends ElementType, P extends object> = FunctionComponent<
  Omit<ComponentProps<C>, keyof P | 'as' | 'style'> & P & { as?: ElementType; style?: StyleProp }
>

export type Styled<T> = <C extends ElementType>(
  tag: C,
  options?: StyledOptions
) => <P extends object = object>(...styles: StyleInput<T, P>[]) => StyledComponent<C, P>

/** A set of named styles; `E` is what one of them becomes. */
export interface SheetDefinition<S extends SheetStyles, E> {
  /** Never set at run time: it only carries the types. */
  readonly entries?: { [K in keyof S]: E }
}

export interface ThemeProviderProps<T> {
  /** The theme, or the part of it that this subtree changes. */
  readonly theme: DeepPartial<T>
  /** Ignored on React Native. */
  readonly colorScheme?: ColorScheme
  /** Ignored on React Native. */
  readonly className?: string
  /** Accepted and ignored: there are no classes on React Native, so the provider never renders an element. */
  readonly isRoot?: boolean
  readonly children?: ReactNode
}

export interface NativeStyle<T> {
  styled: Styled<T>
  /** The platform StyleSheet, with a `create` that resolves the styles with the theme and registers them. */
  StyleSheet: Omit<typeof platformStyleSheet, 'create'> & {
    create<S extends SheetStyles>(styles: S | ((theme: T) => S)): SheetDefinition<S, StyleObject>
  }
  useStyle<S extends SheetStyles>(
    sheet: SheetDefinition<S, StyleObject>
  ): {
    [K in keyof S]: StyleObject
  }
  /** The props that apply entries of a sheet: a style array. */
  apply(...entries: (StyleObject | null | undefined | false)[]): { style: StyleObject[] }
  ThemeProvider(props: ThemeProviderProps<T>): ReactElement
  /** The real theme values, for JavaScript that needs a number or a name. */
  useTheme(): T
  /** Always '': there are no classes on React Native. */
  themeClass(theme: DeepPartial<T>, colorScheme?: ColorScheme): string
}
