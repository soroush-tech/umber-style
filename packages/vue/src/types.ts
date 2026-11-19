import type { Component, ComputedRef, FunctionalComponent } from 'vue'
import type {
  BindingOptions,
  ColorScheme,
  DeepPartial,
  Engine,
  SheetEntry,
  SheetInput,
  SheetStyles,
  StyleInput,
  StylerOptions,
  WebStyleObject,
} from '@umber-style/core'

export type StyleOptions<T = never> = BindingOptions<T>

export interface StyledOptions extends StylerOptions {
  /** Whether an attribute is forwarded to a string tag. Default: every attribute but `as`, `theme` and `class`. */
  shouldForwardProp?: (prop: string) => boolean
}

/** What a styled component keeps, so that styling it again flattens into one element. */
export interface StyledStatics {
  /** Every style of the component, the styles of the components it wraps first. */
  _styles: readonly StyleInput[]
  /** The tag or component that is finally rendered. */
  _tag: string | Component
  _shouldForwardProp?: (prop: string) => boolean
}

export type StyledComponent = FunctionalComponent<Record<string, unknown>> & StyledStatics

export type Styled<T> = (
  tag: string | Component,
  options?: StyledOptions
) => (...styles: StyleInput<T, Record<string, unknown>>[]) => StyledComponent

/** A set of named styles: its class names are made on first use. */
export interface Sheet<S extends SheetStyles> {
  isDynamic: boolean
  resolve(theme?: unknown): { [K in keyof S]: SheetEntry }
}

export interface ThemeProviderProps<T> {
  /** The theme, or the part of it that this subtree changes. */
  theme: DeepPartial<T>
  colorScheme?: ColorScheme
  /** The element that carries the theme class. Default 'div'. */
  as?: string
  /** Renders no element and no class: the app puts `themeClass(theme)` on an ancestor, usually `<html>`. */
  isRoot?: boolean
}

export interface Style<T> {
  engine: Engine<T>
  cache: Engine<T>['cache']
  styled: Styled<T>
  StyleSheet: {
    create<K extends string>(styles: SheetInput<K, T>): Sheet<Record<K, WebStyleObject>>
  }
  useStyle<S extends SheetStyles>(sheet: Sheet<S>): { [K in keyof S]: SheetEntry }
  /** The attributes that apply entries of a sheet: a class. */
  apply(...entries: (SheetEntry | string | null | undefined | false)[]): { class?: string }
  ThemeProvider: Component<ThemeProviderProps<T>>
  /** The real theme values, merged over the providers above; reactive. Call it in `setup`. */
  useTheme(): ComputedRef<T>
  themeClass: Engine<T>['themeClass']
  /** A style key for "the nearest theme is this theme"; it needs `@scope`. */
  when: Engine<T>['when']
  /** A style key for "the nearest color scheme is this one": the nearest theme given that `colorScheme`, else the system preference. */
  whenScheme: Engine<T>['whenScheme']
}
