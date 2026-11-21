// The types of `umber-style/react` under the `react-server` custom condition: at run time the entry is the
// server build of the web binding, whose `useTheme` returns the base theme, and which has `readTheme`, the
// same function. The React Native binding has no `readTheme` and no server build, so code that must run on
// React Native uses `useTheme`. This file holds types and declarations only: it is never loaded.
import type { DefaultStyleOptions, StyleOptions, Theme } from '@umber-style/react'
import type { SharedStyleBase } from './sharedCommon'

export * from './sharedCommon'

/** The styling of one theme shape for server components: `useTheme` is a plain function there, and returns the base theme. */
export interface SharedServerStyle<T> extends SharedStyleBase<T> {
  /** Another name of `useTheme` in server components: the base theme, else an empty object. */
  readTheme(): T
}

export declare const readTheme: SharedServerStyle<Theme>['readTheme']
/** Makes the styling of one theme shape for server components, apart from the default one. */
export declare function createStyle<T extends object>(
  theme: T,
  options?: StyleOptions<T>
): SharedServerStyle<T>
/** Makes one default style for server components, with `configure` for its options and base theme before first use. */
export declare function createDefaultStyle(): SharedServerStyle<Theme> & {
  configure: (options: DefaultStyleOptions) => void
}
