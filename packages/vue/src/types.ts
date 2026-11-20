import type { Component, ComputedRef, FunctionalComponent } from 'vue'
import type {
  BindingOptions,
  ColorScheme,
  Engine,
  GlobalInput,
  GlobalStyles,
  GlobalStylesInput,
  KeyframesInput,
  KeyframesOptions,
  ObjectSheet,
  SheetEntry,
  SheetStyles,
  StyleInput,
  StylerOptions,
  ThemeInput,
  WebStyleObject,
} from '@umber-style/core'

/** The style types of the core that an app annotates with or uses `satisfies` with. */
export type {
  AlphaColor,
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
  /**
   * The theme, or the part of it that this subtree changes; or a function of the theme above (the base
   * theme, or an empty object, for the outermost provider) that returns it. It is merged over the theme above.
   */
  theme: ThemeInput<T>
  colorScheme?: ColorScheme
  /** The element of the wrapper of a nested provider. Default 'div'. */
  as?: string
  /**
   * Renders no element, no class and no rule: the app puts `themeClass(theme)` on an ancestor, usually
   * `<html>`. Without it the outermost provider declares its theme on `:root`, and renders no element either.
   */
  isRoot?: boolean
}

export interface GlobalProps<T> {
  /**
   * The global styles: a handle that `globalStyles` made, a style object, a function of the theme, or a
   * list of them, written in the order of the list. A function of the theme reads the nearest provider:
   * tokens are references, raw keys (`breakpoints`) are its real values.
   */
  styles: GlobalInput<T>
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
  keyframes(steps: KeyframesInput<T>, options?: KeyframesOptions): string
  /** Makes global styles (selectors and at-rules as keys) and returns their handle, for `Global`. It writes nothing and needs no engine. */
  globalStyles(styles: GlobalStylesInput<T>): GlobalStyles<T>
  /**
   * Writes global styles into the `global` layer while it is mounted, and renders nothing. In the browser
   * the rules are removed when it unmounts, and replaced when its styles, or what they read of the theme,
   * change. On a server they are written for good, for `extractPageStyles`.
   */
  Global: Component<GlobalProps<T>>
}
