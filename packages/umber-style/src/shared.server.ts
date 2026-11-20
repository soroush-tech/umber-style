// The types of `umber-style/react` under the `react-server` custom condition: at run time the entry is the
// server build of the web binding, which has `readTheme` and no `useTheme`. The React Native binding has
// neither `readTheme` nor a server build, so code that must run on React Native does not use it. This
// file holds types and declarations only: it is never loaded.
import type { DefaultStyleOptions, StyleOptions, Theme } from '@umber-style/react'
import type { SharedStyleBase } from './sharedCommon'

export * from './sharedCommon'

/** The styling of one theme shape for server components: the root theme is read with `readTheme`, not a hook. */
export interface SharedServerStyle<T> extends SharedStyleBase<T> {
  /** The root theme of the request, or the base theme of the engine; throws when there is neither. */
  readTheme(): T
}

export declare const readTheme: SharedServerStyle<Theme>['readTheme']
export declare function createStyle<T extends object>(
  theme: T,
  options?: StyleOptions<T>
): SharedServerStyle<T>
export declare function createDefaultStyle(): SharedServerStyle<Theme> & {
  configure: (options: DefaultStyleOptions) => void
}
