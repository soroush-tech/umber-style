import { at } from '@umber-style/react'
import { omitProps, styled } from './style'

export type ButtonProps = { variant?: 'primary' | 'secondary' | 'outline' }

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
  ({ theme, variant = 'primary' }) => ({
    padding: `${theme.space[2]} ${theme.space[3]}`,
    borderRadius: theme.radii[1],
    borderColor: variant === 'outline' ? theme.palette.primary : theme.palette.border,
    backgroundColor:
      variant === 'primary'
        ? theme.palette.primary
        : variant === 'secondary'
          ? theme.palette.surface
          : 'transparent',
    color: variant === 'primary' ? theme.palette.onPrimary : theme.palette.text,
  })
)

export const Card = styled('section', { name: 'Card' })(({ theme }) => ({
  backgroundColor: theme.palette.surface,
  color: theme.palette.text,
  border: `1px solid ${theme.palette.border}`,
  borderRadius: theme.radii[2],
  padding: theme.space[3],
}))

export type FlexProps = { gap?: number; direction?: 'row' | 'column'; wrap?: boolean }

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
export const Page = styled('main', { name: 'Page' })(({ theme }) => ({
  backgroundColor: theme.palette.background,
  color: theme.palette.text,
  padding: theme.space[3],
  fontFamily: 'sans-serif',
  ...at(`@media (min-width: ${theme.breakpoints[0]})`, { padding: theme.space[5] }),
}))

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
export const Hero = styled('div', { name: 'Hero' })(({ theme }) => ({
  backgroundColor: theme.palette.primary,
  color: theme.palette.onPrimary,
  padding: theme.space[4],
  borderRadius: theme.radii[2],
}))

/** Catalog only. */
export const Badge = styled('span', { name: 'Badge' })(({ theme }) => ({
  display: 'inline-block',
  fontSize: theme.fontSizes[0],
  padding: `${theme.space[1]} ${theme.space[2]}`,
  borderRadius: theme.radii[2],
  border: `1px solid ${theme.palette.border}`,
  color: theme.palette.muted,
}))

/** Catalog only. */
export const ProductGrid = styled('div', { name: 'ProductGrid' })(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: theme.space[3],
}))

/** Settings only. */
export const Panel = styled('div', { name: 'Panel' })(({ theme }) => ({
  borderLeft: `4px solid ${theme.palette.primary}`,
  paddingLeft: theme.space[3],
  width: 320,
}))

/** Settings only, and the only component that uses the accent colour: a token that no other page uses. */
export const Callout = styled('aside', { name: 'Callout' })(({ theme }) => ({
  borderTop: `3px solid ${theme.palette.accent}`,
  color: theme.palette.accent,
  paddingTop: theme.space[2],
}))

/** The bar with the links. */
export const NavBar = styled('nav', { name: 'NavBar' })(({ theme }) => ({
  display: 'flex',
  gap: theme.space[3],
  padding: theme.space[2],
  borderBottom: `1px solid ${theme.palette.border}`,
  backgroundColor: theme.palette.surface,
  '& a': { color: theme.palette.primary },
}))
