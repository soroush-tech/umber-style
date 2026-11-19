import { at } from '@umber-style/vue'
import { omitProps, styled } from './style'

// The same components as the React fixtures, written for the Vue binding: attributes, not props.
// A function style of the Vue binding is not typed by its attributes, so `any` stands for them here.
type Theme = any
type Attrs = { theme: Theme; [name: string]: any }

export const Button = styled('button', { name: 'Button', shouldForwardProp: omitProps('variant') })(
  {
    font: 'inherit',
    cursor: 'pointer',
    borderStyle: 'solid',
    borderWidth: 1,
    '&:hover': { opacity: 0.85 },
  },
  ({ theme, variant = 'primary' }: Attrs) => ({
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

export const Card = styled('section', { name: 'Card' })(({ theme }: Attrs) => ({
  backgroundColor: theme.palette.surface,
  color: theme.palette.text,
  border: `1px solid ${theme.palette.border}`,
  borderRadius: theme.radii[2],
  padding: theme.space[3],
}))

export const Flex = styled('div', {
  name: 'Flex',
  shouldForwardProp: omitProps('gap', 'direction', 'wrap'),
})({ display: 'flex' }, ({ theme, gap = 2, direction = 'row', wrap = false }: Attrs) => ({
  gap: theme.space[gap],
  flexDirection: direction,
  flexWrap: wrap ? 'wrap' : 'nowrap',
}))

export const Page = styled('main', { name: 'Page' })(({ theme }: Attrs) => ({
  backgroundColor: theme.palette.background,
  color: theme.palette.text,
  padding: theme.space[3],
  fontFamily: 'sans-serif',
  ...at(`@media (min-width: ${theme.breakpoints[0]})`, { padding: theme.space[5] }),
}))

export const Heading = styled('h1', { name: 'Heading' })(({ theme }: Attrs) => ({
  margin: 0,
  fontSize: theme.fontSizes[4],
  color: theme.palette.text,
}))

export const Muted = styled('p', { name: 'Muted' })(({ theme }: Attrs) => ({
  margin: 0,
  fontSize: theme.fontSizes[1],
  color: theme.palette.muted,
}))

export const Hero = styled('div', { name: 'Hero' })(({ theme }: Attrs) => ({
  backgroundColor: theme.palette.primary,
  color: theme.palette.onPrimary,
  padding: theme.space[4],
  borderRadius: theme.radii[2],
}))

export const Badge = styled('span', { name: 'Badge' })(({ theme }: Attrs) => ({
  display: 'inline-block',
  fontSize: theme.fontSizes[0],
  padding: `${theme.space[1]} ${theme.space[2]}`,
  borderRadius: theme.radii[2],
  border: `1px solid ${theme.palette.border}`,
  color: theme.palette.muted,
}))

export const ProductGrid = styled('div', { name: 'ProductGrid' })(({ theme }: Attrs) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: theme.space[3],
}))

export const Panel = styled('div', { name: 'Panel' })(({ theme }: Attrs) => ({
  borderLeft: `4px solid ${theme.palette.primary}`,
  paddingLeft: theme.space[3],
  width: 320,
}))

export const Callout = styled('aside', { name: 'Callout' })(({ theme }: Attrs) => ({
  borderTop: `3px solid ${theme.palette.accent}`,
  color: theme.palette.accent,
  paddingTop: theme.space[2],
}))

export const NavBar = styled('nav', { name: 'NavBar' })(({ theme }: Attrs) => ({
  display: 'flex',
  gap: theme.space[3],
  padding: theme.space[2],
  borderBottom: `1px solid ${theme.palette.border}`,
  backgroundColor: theme.palette.surface,
  '& a': { color: theme.palette.primary },
}))
