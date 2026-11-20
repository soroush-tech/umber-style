// The types of `umber-style/react`: the styling that runs on the web and on React Native. At run time the
// entry is the web binding or the React Native binding (the export conditions pick one); for the compiler
// the `types` condition of the entry points here, so one source type-checks the same under both. Under the
// `react-server` custom condition the entry points at `shared.server.ts` instead. This file holds types
// and declarations only: it is never loaded.
import type { Context, ReactElement } from 'react'
import type { DefaultStyleOptions, StyleOptions, Theme, ThemeScopeProps } from '@umber-style/react'
import type { SharedStyleBase } from './sharedCommon'

export * from './sharedCommon'
export type { ThemeScopeProps }

/** The styling of one theme shape, with the names that both platforms have. */
export interface SharedStyle<T> extends SharedStyleBase<T> {
  /** The real theme values, in a component: of the nearest provider, else the base theme, else an empty object. */
  useTheme(): T
  /** The context that holds the real theme of the nearest provider; undefined with no provider above. */
  ThemeContext: Context<T | undefined>
  /** On the web, the wrapper of the nearest nested provider again around its children, for portal content; on React Native, and under the outermost provider, its children. */
  ThemeScope(props: ThemeScopeProps): ReactElement
  /** On the web, the class string of the wrapper of the nearest nested provider; undefined under the outermost provider, or none, and on React Native. */
  useThemeClass(): string | undefined
}

export declare const useTheme: SharedStyle<Theme>['useTheme']
export declare const ThemeContext: SharedStyle<Theme>['ThemeContext']
export declare const ThemeScope: SharedStyle<Theme>['ThemeScope']
export declare const useThemeClass: SharedStyle<Theme>['useThemeClass']
export declare function createStyle<T extends object>(
  theme: T,
  options?: StyleOptions<T>
): SharedStyle<T>
export declare function createDefaultStyle(): SharedStyle<Theme> & {
  configure: (options: DefaultStyleOptions) => void
}
