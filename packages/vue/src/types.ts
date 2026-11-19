import type { Component, ComputedRef, FunctionalComponent } from 'vue'
import type {
  BindingOptions,
  ColorScheme,
  DeepPartial,
  Engine,
  ObjectSheet,
  SheetEntry,
  SheetStyles,
  StyleInput,
  StylerOptions,
  WebStyleObject,
} from '@umber-style/core'

/** The style types of the core that an app annotates with or uses `satisfies` with. */
export type {
  AlphaColor,
  NestedKey,
  SchemeKey,
  SchemeName,
  SheetEntry,
  StyleObject,
  ThemeKey,
  WebNested,
  WebProperties,
  WebStyleObject,
} from '@umber-style/core'

export type StyleOptions<T = never> = BindingOptions<T>

export interface StyledOptions extends StylerOptions {
  /** Whether an attribute is forwarded to a string tag. Default: every attribute but `as`, `theme`, `class` and `style`, which the component handles itself. */
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

/** A set of named styles made from a function of the theme: it has no entries until `useStyle` resolves it. */
export interface Sheet<S extends SheetStyles> {
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
