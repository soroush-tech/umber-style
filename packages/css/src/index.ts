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
  Theme,
  UmberCache,
} from '@umber-style/core'

/** The default instance: key `css`, rules outside every cascade layer. */
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
} = createInstance({ key: 'css' })
