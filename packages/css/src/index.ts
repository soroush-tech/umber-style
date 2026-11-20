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
