import type { AppTheme } from '@umber-fixtures/shared/themes'
import { at } from '@umber-style/vue'
import { globalStyles, keyframes, omitProps, styled } from './style'

// The same components as the React fixtures, written for the Vue binding: attributes, not props.
// A function style of the Vue binding is not typed by its attributes: each one is `unknown`, and a
// style narrows the ones it reads.
type Theme = AppTheme
type Attrs = Record<string, unknown> & { theme: Theme }

export const Button = styled('button', { name: 'Button', shouldForwardProp: omitProps('variant') })(
  {
    font: 'inherit',
    cursor: 'pointer',
    borderStyle: 'solid',
    borderWidth: 1,
    '&:hover': { opacity: 0.85 },
  },
  ({ theme, variant = 'primary' }: Attrs) => {
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

export const Card = styled('section', { name: 'Card' })(({ theme }: Attrs) => {
  const { palette, radii, space } = theme
  return {
    backgroundColor: palette.surface,
    color: palette.text,
    border: `1px solid ${palette.border}`,
    borderRadius: radii[2],
    padding: space[3],
  }
})

export const Flex = styled('div', {
  name: 'Flex',
  shouldForwardProp: omitProps('gap', 'direction', 'wrap'),
})({ display: 'flex' }, ({ theme, gap, direction, wrap = false }: Attrs) => ({
  gap: theme.space[typeof gap === 'number' ? gap : 2],
  flexDirection: direction === 'column' ? 'column' : 'row',
  flexWrap: wrap ? 'wrap' : 'nowrap',
}))

export const Page = styled('main', { name: 'Page' })(({ theme }: Attrs) => {
  const { breakpoints, palette, space } = theme
  return {
    backgroundColor: palette.background,
    color: palette.text,
    padding: space[3],
    fontFamily: 'sans-serif',
    ...at(`@media (min-width: ${breakpoints[0]})`, { padding: space[5] }),
  }
})

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

export const Hero = styled('div', { name: 'Hero' })(({ theme }: Attrs) => {
  const { palette, radii, space } = theme
  return {
    backgroundColor: palette.primary,
    color: palette.onPrimary,
    padding: space[4],
    borderRadius: radii[2],
  }
})

export const Badge = styled('span', { name: 'Badge' })(({ theme }: Attrs) => {
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

export const ProductGrid = styled('div', { name: 'ProductGrid' })(({ theme }: Attrs) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: theme.space[3],
}))

// The animations of the home page: they move `transform` and `outline-color` only, as in the React fixtures.
const spin = keyframes({ to: { transform: 'rotate(1turn)' } }, { label: 'spin' })

const pulse = keyframes(
  (theme: Theme) => ({
    '0%, 100%': { transform: 'scale(1)', outlineColor: theme.palette.onPrimary },
    '50%': { transform: 'scale(1.25)', outlineColor: theme.palette.border },
  }),
  { label: 'pulse' }
)

export const Spinner = styled('span', { name: 'Spinner' })(({ theme }: Attrs) => ({
  display: 'inline-block',
  width: 16,
  height: 16,
  border: `2px dashed ${theme.palette.onPrimary}`,
  borderRadius: '50%',
  animation: `${spin} 1s linear infinite`,
}))

export const Pulse = styled('span', { name: 'Pulse' })(({ theme }: Attrs) => ({
  display: 'inline-block',
  width: 16,
  height: 16,
  outline: `2px solid ${theme.palette.onPrimary}`,
  animationName: pulse,
  animationDuration: 1500,
  animationTimingFunction: 'ease-in-out',
  animationIterationCount: 'infinite',
}))

export const Panel = styled('div', { name: 'Panel' })(({ theme }: Attrs) => ({
  borderLeft: `4px solid ${theme.palette.primary}`,
  paddingLeft: theme.space[3],
  width: 320,
}))

export const Callout = styled('aside', { name: 'Callout' })(({ theme }: Attrs) => {
  const { palette, space } = theme
  return {
    borderTop: `3px solid ${palette.accent}`,
    color: palette.accent,
    paddingTop: space[2],
  }
})

export const NavBar = styled('nav', { name: 'NavBar' })(({ theme }: Attrs) => {
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

/** The base styles of every page, the same as in the React fixtures. */
export const baseStyles = globalStyles((theme: Theme) => {
  const { breakpoints, palette } = theme
  return {
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

/** A frame at the top of the page, in the primary colour, while the frame switch is on. */
export const frameStyles = globalStyles((theme: Theme) => ({
  body: { borderTop: `4px solid ${theme.palette.primary}` },
}))

/** A global rule for the bar, outside the page that renders it: the promo page only, as in the React fixtures. */
export const headerOverride = globalStyles((theme: Theme) => ({
  '[data-testid="nav"]': { outline: `3px solid ${theme.palette.accent}` },
}))
