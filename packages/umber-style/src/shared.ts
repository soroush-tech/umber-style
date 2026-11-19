// The types of `umber-style/react`: the styling that runs on the web and on React Native. At run time the
// entry is the web binding or the React Native binding (the export conditions pick one); for the compiler
// the `types` condition of the entry points here, so one source type-checks the same under both. Under the
// `react-server` custom condition the entry points at `shared.server.ts` instead. This file holds types
// and declarations only: it is never loaded.
import type { Theme } from '@umber-style/core'
import type { DefaultStyleOptions, StyleOptions } from '@umber-style/react'
import type { SharedStyleBase } from './sharedCommon'

export * from './sharedCommon'

/** The styling of one theme shape, with the names that both platforms have. */
export interface SharedStyle<T> extends SharedStyleBase<T> {
  /** The real theme values, in a component. */
  useTheme(): T
}

export declare const useTheme: SharedStyle<Theme>['useTheme']
export declare function createStyle<T extends object>(
  theme: T,
  options?: StyleOptions<T>
): SharedStyle<T>
export declare function createDefaultStyle(): SharedStyle<Theme> & {
  configure: (options: DefaultStyleOptions) => void
}
