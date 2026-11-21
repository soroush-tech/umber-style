import { createElement, Fragment, type ReactElement } from 'react'
import type { CacheProviderProps } from './types'

/** `CacheProvider` on React Native: there is no CSS to write, so it renders its children and reads no cache. */
export function CacheProvider({ children }: CacheProviderProps): ReactElement {
  return createElement(Fragment, null, children)
}
