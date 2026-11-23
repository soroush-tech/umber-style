/**
 * `styled` of the default style of `@umber-style/react`, as the default export and by name. It is the same
 * function: `configure` of `@umber-style/react` sets its engine, and a server component gets the server
 * build, which the `react-server` condition picks when `@umber-style/react` is resolved.
 */
// Also by name: a CommonJS build of a library that imports this entry by default gets the whole
// `module.exports` from its interop, not the function; one that imports it by name gets the function.
export { styled as default, styled } from '@umber-style/react'

export type {
  CreateStyled,
  CreateStyledComponent,
  CSSObject,
  FilteringStyledOptions,
  Interpolation,
  PropsOf,
  Styled,
  StyledComponent,
  StyledFactory,
  StyledOptions,
  StyledStatics,
  StyledTags,
  StyleProp,
  StyleTypeOptions,
  Theme,
} from '@umber-style/react'
