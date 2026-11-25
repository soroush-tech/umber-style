// The types of `umber-style/react`: the styling that runs on the web and on React Native. At run time the
// entry is the web binding or the React Native binding (the export conditions pick one); for the compiler
// the `types` condition of the entry points here, so one source type-checks the same under both. Under the
// `react-server` custom condition the entry points at `shared.server.ts` instead. This file holds types
// and declarations only: it is never loaded.
import type { Context, ReactElement } from 'react'
import type {
  CacheProviderProps,
  DefaultStyleOptions,
  StyleOptions,
  Theme,
  ThemeScopeProps,
} from '@umber-style/react'
import type { MotionOptions, SharedStyleBase } from './sharedCommon'

export * from './sharedCommon'
export type { CacheProviderProps, ThemeScopeProps }

/** The options of `useMediaQuery`, the same on both platforms. */
export interface MediaQueryOptions {
  /** The answer where it cannot be known yet: a server render on the web. Default false. */
  defaultMatches?: boolean
}

/** The styling of one theme shape, with the names that both platforms have. */
export interface SharedStyle<T> extends SharedStyleBase<T> {
  /** The context that holds the real theme of the nearest provider; undefined with no provider above. */
  ThemeContext: Context<T | undefined>
  /** On the web, the wrapper of the nearest nested provider again around its children, for portal content; on React Native, and under the outermost provider, its children. */
  ThemeScope(props: ThemeScopeProps): ReactElement
  /** On the web, the class string of the wrapper of the nearest nested provider; undefined under the outermost provider, or none, and on React Native. */
  useThemeClass(): string | undefined
}

export declare const ThemeContext: SharedStyle<Theme>['ThemeContext']
export declare const ThemeScope: SharedStyle<Theme>['ThemeScope']
export declare const useThemeClass: SharedStyle<Theme>['useThemeClass']
/** On the web, gives the subtree its cache: the rules of its components go there; on React Native, its children. */
export declare function CacheProvider(props: CacheProviderProps): ReactElement
/** Whether the media query matches: the window on React Native, `matchMedia` on the web, where a server render gives `defaultMatches`, false when it is not given. */
export declare function useMediaQuery(query: string, options?: MediaQueryOptions): boolean
/** Makes the styling of one theme shape, apart from the default one, on either platform. */
export declare function createStyle<T extends object>(
  theme: T,
  options?: StyleOptions<T> & MotionOptions
): SharedStyle<T>
/** Makes one default style, with `configure` for its options and base theme before first use. */
export declare function createDefaultStyle(): SharedStyle<Theme> & {
  configure: (options: DefaultStyleOptions & MotionOptions) => void
}
