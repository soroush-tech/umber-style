import { readSharedState } from '@umber-style/core/internal'
import createInstance from './createInstance'

export type {
  ClassNamesInput,
  CssFunction,
  CssInput,
  CssInstance,
  InjectGlobalFunction,
  InjectGlobalInput,
  InstanceOptions,
  KeyframesFunction,
  SharedCache,
} from './createInstance'

/** The style, animation, theme and cache types of the core, under the names apps import, so that a file needs one import. */
export type {
  CSSObject,
  Interpolation,
  Keyframes,
  SerializedStyles,
  StyleTypeOptions,
  Theme,
  UmberCache,
} from '@umber-style/core'

/** The default instance: key `css`, rules outside every cascade layer. Every copy of the package in the program shares it, so that a class one copy made is merged and extracted by another. */
export const {
  css,
  cx,
  keyframes,
  injectGlobal,
  cache,
  sheet,
  flush,
  hydrate,
  getRegisteredStyles,
  merge,
} = readSharedState('css.default-instance@1', () => createInstance({ key: 'css' }))
