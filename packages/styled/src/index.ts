import { styled } from '@umber-style/react'

/**
 * `styled` of the default style of `@umber-style/react`, as the default export. It is the same function:
 * `configure` of `@umber-style/react` sets its engine, and a server component gets the server build, which
 * the `react-server` condition picks when `@umber-style/react` is resolved.
 */
export default styled

export type {
  Styled,
  StyledComponent,
  StyledFactory,
  StyledOptions,
  StyledStatics,
  StyledTags,
  StyleProp,
} from '@umber-style/react'
