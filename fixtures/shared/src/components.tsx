import { at } from '@umber-style/react'
import { Global, globalStyles, keyframes, omitProps, styled } from './style'

/** The props of `Button`. */
export type ButtonProps = {
  /** The look of the button: filled in the primary colour, on the surface, or outlined. Default `primary`. */
  variant?: 'primary' | 'secondary' | 'outline'
}

/** A button whose look comes from a prop. Its own :hover rule is in the base class. */
export const Button = styled('button', {
  name: 'Button',
  shouldForwardProp: omitProps('variant'),
})<ButtonProps>(
  {
    font: 'inherit',
    cursor: 'pointer',
    borderStyle: 'solid',
    borderWidth: 1,
    '&:hover': { opacity: 0.85 },
  },
  ({ theme, variant = 'primary' }) => {
    const { palette, radii, space } = theme
    return {
      padding: `${space[2]} ${space[3]}`,
      borderRadius: radii[1],
      borderColor: variant === 'outline' ? palette.primary : palette.border,
      backgroundColor:
        variant === 'primary'
          ? palette.primary
          : variant === 'secondary'
            ? palette.surface
            : 'transparent',
      color: variant === 'primary' ? palette.onPrimary : palette.text,
    }
  }
)

export const Card = styled('section', { name: 'Card' })(({ theme }) => {
  const { palette, radii, space } = theme
  return {
    backgroundColor: palette.surface,
    color: palette.text,
    border: `1px solid ${palette.border}`,
    borderRadius: radii[2],
    padding: space[3],
  }
})

/** The props of `Flex`. */
export type FlexProps = {
  /** The step of the theme's `space` between the children. Default 2. */
  gap?: number
  /** The `flex-direction`. Default `row`. */
  direction?: 'row' | 'column'
  /** Whether the children wrap. Default false. */
  wrap?: boolean
}

/** A flex container whose gap, direction and wrapping come from props. */
export const Flex = styled('div', {
  name: 'Flex',
  shouldForwardProp: omitProps('gap', 'direction', 'wrap'),
})<FlexProps>({ display: 'flex' }, ({ theme, gap = 2, direction = 'row', wrap = false }) => ({
  gap: theme.space[gap],
  flexDirection: direction,
  flexWrap: wrap ? 'wrap' : 'nowrap',
}))

/** The frame of every page. Its padding grows at the first breakpoint of the theme. */
export const Page = styled('main', { name: 'Page' })(({ theme }) => {
  const { breakpoints, palette, space } = theme
  return {
    backgroundColor: palette.background,
    color: palette.text,
    padding: space[3],
    fontFamily: 'sans-serif',
    ...at(`@media (min-width: ${breakpoints[0]})`, { padding: space[5] }),
  }
})

export const Heading = styled('h1', { name: 'Heading' })(({ theme }) => ({
  margin: 0,
  fontSize: theme.fontSizes[4],
  color: theme.palette.text,
}))

export const Muted = styled('p', { name: 'Muted' })(({ theme }) => ({
  margin: 0,
  fontSize: theme.fontSizes[1],
  color: theme.palette.muted,
}))

// The components below are each used by one page only.

/** Home only. */
export const Hero = styled('div', { name: 'Hero' })(({ theme }) => {
  const { palette, radii, space } = theme
  return {
    backgroundColor: palette.primary,
    color: palette.onPrimary,
    padding: space[4],
    borderRadius: radii[2],
  }
})

/** Catalog only. */
export const Badge = styled('span', { name: 'Badge' })(({ theme }) => {
  const { fontSizes, palette, radii, space } = theme
  return {
    display: 'inline-block',
    fontSize: fontSizes[0],
    padding: `${space[1]} ${space[2]}`,
    borderRadius: radii[2],
    border: `1px solid ${palette.border}`,
    color: palette.muted,
  }
})

/** Catalog only. */
export const ProductGrid = styled('div', { name: 'ProductGrid' })(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: theme.space[3],
}))

// The animations of the home page. They move `transform` and `outline-color` only: the end-to-end
// tests compare other properties between loads, which a running animation would make differ.
const spin = keyframes({ to: { transform: 'rotate(1turn)' } }, { label: 'spin' })

const pulse = keyframes(
  (theme) => ({
    '0%, 100%': { transform: 'scale(1)', outlineColor: theme.palette.onPrimary },
    '50%': { transform: 'scale(1.25)', outlineColor: theme.palette.border },
  }),
  { label: 'pulse' }
)

/** Home only: turns for ever, its animation named inside the `animation` shorthand. */
export const Spinner = styled('span', { name: 'Spinner' })(({ theme }) => ({
  display: 'inline-block',
  width: 16,
  height: 16,
  border: `2px dashed ${theme.palette.onPrimary}`,
  borderRadius: '50%',
  animation: `${spin} 1s linear infinite`,
}))

/** Home only: beats for ever, its animation named in `animationName`, with a step that reads tokens. */
export const Pulse = styled('span', { name: 'Pulse' })(({ theme }) => ({
  display: 'inline-block',
  width: 16,
  height: 16,
  outline: `2px solid ${theme.palette.onPrimary}`,
  animationName: pulse,
  animationDuration: 1500,
  animationTimingFunction: 'ease-in-out',
  animationIterationCount: 'infinite',
}))

/** Settings only. */
export const Panel = styled('div', { name: 'Panel' })(({ theme }) => ({
  borderLeft: `4px solid ${theme.palette.primary}`,
  paddingLeft: theme.space[3],
  width: 320,
}))

/** Settings only, and the only component that uses the accent colour: a token that no other page uses. */
export const Callout = styled('aside', { name: 'Callout' })(({ theme }) => {
  const { palette, space } = theme
  return {
    borderTop: `3px solid ${palette.accent}`,
    color: palette.accent,
    paddingTop: space[2],
  }
})

/** The bar with the links. */
export const NavBar = styled('nav', { name: 'NavBar' })(({ theme }) => {
  const { palette, space } = theme
  return {
    display: 'flex',
    gap: space[3],
    padding: space[2],
    borderBottom: `1px solid ${palette.border}`,
    backgroundColor: palette.surface,
    '& a': { color: palette.primary },
  }
})

// Global styles. This file exports components only, so that React's fast refresh replaces it in place
// when the development tests edit it: each handle is written by a component of its own.

const baseStyles = globalStyles((theme) => {
  const { breakpoints, palette } = theme
  return {
    // Two faces of a font that the system has: a list, written as one `@font-face` rule each.
    '@font-face': [
      { fontFamily: 'Umber Fixture Sans', src: 'local("Arial")', fontWeight: 400 },
      { fontFamily: 'Umber Fixture Sans', src: 'local("Arial Bold")', fontWeight: 700 },
    ],
    body: {
      margin: 0,
      backgroundColor: palette.background,
      color: palette.text,
      fontFamily: '"Umber Fixture Sans", sans-serif',
    },
    '#app-root': { minHeight: '100vh' },
    [`@media (min-width: ${breakpoints[0]})`]: { body: { lineHeight: 1.5 } },
  }
})

/** The base styles of every page: the shell renders it. */
export function BaseStyles() {
  return <Global styles={baseStyles} />
}

const frameStyles = globalStyles((theme) => ({
  body: { borderTop: `4px solid ${theme.palette.primary}` },
}))

/** A frame at the top of the page, in the primary colour, for as long as this is mounted. */
export function FrameStyles() {
  return <Global styles={frameStyles} />
}

// The outline is not among the properties that the other scenarios compare: a rule that is left in the
// page shows in the tests of the promo page, not as a difference in theirs.
const headerOverride = globalStyles((theme) => ({
  '[data-testid="nav"]': { outline: `3px solid ${theme.palette.accent}` },
}))

/** A global rule for the bar of the shell, outside the page that renders it: the promo page only. */
export function HeaderOverride() {
  return <Global styles={headerOverride} />
}
