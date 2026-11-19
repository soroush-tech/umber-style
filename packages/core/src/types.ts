import type { Cache } from './cache'
import type { StyleObject } from './serialize'
import type { TokenOptions } from './tokens'

export interface EngineOptions extends TokenOptions {
  /** First part of every class name and variable name. Default 'css'. */
  prefix?: string
  /** Appended to every class name. */
  suffix?: string
  /** Whether a style's label is part of its class name. */
  hasLabels?: boolean
  /** The cache to use; one is made when not given. */
  cache?: Cache
}

export type ColorScheme = 'light' | 'dark' | 'light dark'

/** What a style function may return. */
export type StyleResult = StyleObject | null | undefined | false

/** A style that is computed from the props and the theme. */
export type StyleFunction<T, P> = (props: P & { theme: T }) => StyleResult

/** A style object, or a function of the props and the theme; the defaults accept any function. */
export type StyleInput<T = never, P = never> = StyleObject | StyleFunction<T, P>

/** The label of a styled component, and what it takes from the styles of the one it wraps. */
export interface StylerOptions {
  /** With `slot`, the label of the class: `name-slot` in kebab-case. */
  name?: string
  /** Default 'root'. */
  slot?: string
}

export type SheetStyles = Record<string, StyleObject>

/**
 * The shape of the theme of an app. It has no members of its own (the optional one below only keeps it
 * from being empty): an app adds its own by merging, with
 * `declare module '@umber-style/core' { interface Theme extends MyTheme {} }`.
 */
export interface Theme {
  readonly _theme?: never
}
