// The default style types against the shapes of a design system that moves from the styling library it
// used before: props spread from `HTMLAttributes` into a styled component, React's `CSSProperties` given
// to `style`, style objects whose values were widened to `string`, and keys computed from the theme.
// `pnpm typecheck` compiles it without the strict switch (tsconfig.json); the run checks what is written.
import { render, screen } from '@testing-library/react'
import { createCache, createMemorySheet } from '@umber-style/core'
import type {
  ComponentProps,
  ComponentType,
  CSSProperties,
  ElementType,
  HTMLAttributes,
  JSX,
} from 'react'
import { expectTypeOf } from 'vitest'
import { createStyle } from './createStyle'
import type {
  CreateStyled,
  CreateStyledComponent,
  PropsOf,
  StyleProp,
  StyledOptions,
} from './index'

interface AppTheme {
  space: string[]
  breakpoints: string[]
  palette: { primary: { main: string; light: string } }
  zOrder: { snackbar: number }
}

const appTheme: AppTheme = {
  space: ['0px', '4px', '8px'],
  breakpoints: ['40em'],
  palette: { primary: { main: '#0000ff', light: '#8888ff' } },
  zOrder: { snackbar: 1400 },
}

const sheet = createMemorySheet()
const style = createStyle(appTheme, { prefix: 'a', cache: createCache({ prefix: 'a', sheet }) })

/** The `styled` of the app: a tag with `as` and the app's theme, or a component with its props. */
interface AppStyled {
  <C extends ComponentType<ComponentProps<C>>>(
    component: C,
    options?: StyledOptions<ComponentProps<C>>
  ): CreateStyledComponent<PropsOf<C> & { theme?: AppTheme }>
  <Tag extends keyof JSX.IntrinsicElements>(
    tag: Tag,
    options?: StyledOptions<JSX.IntrinsicElements[Tag]>
  ): CreateStyledComponent<{ theme?: AppTheme; as?: ElementType }, JSX.IntrinsicElements[Tag]>
}

const styled = style.styled as CreateStyled<AppTheme> as unknown as AppStyled

/** The rules written so far, as one text. */
const readRules = () => sheet.rules.join('')

interface ViewProps extends HTMLAttributes<HTMLDivElement> {
  gap?: number
}

interface FlexProps extends ViewProps {
  isInline?: boolean
}

const View = styled('div', { label: 'View' })<ViewProps>({ boxSizing: 'border-box' })
const Flex = styled(View, { label: 'Flex' })<FlexProps>(({ isInline }) => ({
  display: isInline ? 'inline-flex' : 'flex',
}))

describe('the default style types, with the shapes of an app', () => {
  it('take the props of HTMLAttributes spread into a styled component, style included', () => {
    interface AppBarProps extends FlexProps {
      elevation?: number
    }
    const AppBarRoot = styled(Flex, { label: 'AppBar' })<AppBarProps>(({ elevation }) => ({
      boxShadow: elevation ? `0 ${elevation}px 4px black` : 'none',
    }))
    function AppBar({ elevation = 4, ...rest }: Readonly<AppBarProps>) {
      return <AppBarRoot as="header" elevation={elevation} {...rest} />
    }
    const inline: CSSProperties = { marginTop: 2 }
    render(<AppBar data-testid="bar" style={inline} title="bar" />)
    expect(screen.getByTestId('bar').tagName).toBe('HEADER')
    expect(screen.getByTestId('bar').getAttribute('style')).toBeNull()
    expect(readRules()).toContain('margin-top:2px;')
  })

  it("take React's CSSProperties, and CSSProperties or undefined, in style", () => {
    const Thumb = styled('span', { label: 'Thumb' })({ position: 'absolute' })
    const position: CSSProperties = { left: '25%' }
    const maybe = (isShown: boolean): CSSProperties | undefined =>
      isShown ? { opacity: 0.5 } : undefined
    render(
      <>
        <Thumb data-testid="thumb" style={position} />
        <Thumb style={maybe(true)} />
        <Thumb style={maybe(false)} />
      </>
    )
    expectTypeOf<CSSProperties>().toExtend<StyleProp>()
    expect(screen.getByTestId('thumb').getAttribute('style')).toBeNull()
    expect(readRules()).toContain('left:25%;')
  })

  it('take a function style that returns values widened to string, and a list of styles', () => {
    interface RootStyle {
      isFullWidth: boolean
      isDisabled: boolean
    }
    const frame = ({ theme, isFullWidth, isDisabled }: RootStyle & { theme: AppTheme }) => ({
      display: isFullWidth ? 'flex' : 'inline-flex',
      alignItems: 'center',
      gap: theme.space[1],
      boxSizing: 'border-box' as const,
      '&:focus-within': { borderColor: theme.palette.primary.main },
      ...(isDisabled && { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' as const }),
    })
    const variant = ({ theme }: { theme: AppTheme }) => ({
      borderColor: theme.palette.primary.light,
    })
    const Root = styled('div', { label: 'Root' })<RootStyle>(variant, frame)
    const card = { display: 'grid', justifyItems: 'start' }
    const Card = styled('div', { label: 'Card' })(card)
    const entry = style.css(card, { alignContent: 'center' })
    const sheetEntries = style.StyleSheet.create({ box: card })
    render(
      <>
        <Root data-testid="root" isFullWidth={false} isDisabled />
        <Card style={[entry, sheetEntries.box]} />
      </>
    )
    expect(readRules()).toContain('display:inline-flex;align-items:center;gap:var(--a-space-1);')
    expect(readRules()).toContain('display:grid;justify-items:start;')
  })

  it('take a key computed from a value of the theme, a media query or a selector', () => {
    type Vertical = 'top' | 'bottom'
    const Snackbar = styled('div', { label: 'Snackbar' })<{ vertical: Vertical }>(
      ({ theme, vertical }) => ({
        position: 'fixed',
        zIndex: theme.zOrder.snackbar,
        [vertical]: theme.space[2],
        [`@media (min-width: ${theme.breakpoints[0]})`]: { left: 'auto' },
      })
    )
    const edgeStyles = ({ theme, isVertical }: { theme: AppTheme; isVertical?: boolean }) => {
      const edge = isVertical ? 'borderTopColor' : 'borderLeftColor'
      return {
        '& > [aria-pressed="true"]:not(:first-of-type)': { [edge]: theme.palette.primary.main },
      }
    }
    const Group = styled(View, { label: 'Group' })<{ isVertical?: boolean }>(edgeStyles)
    render(
      <>
        <Snackbar vertical="bottom" />
        <Group />
      </>
    )
    expect(readRules()).toContain('bottom:var(--a-space-2);')
    expect(readRules()).toContain('@media (min-width: 40em){')
    expect(readRules()).toContain(
      ' > [aria-pressed="true"]:not(:first-of-type){border-left-color:var(--a-palette-primary-main);}'
    )
  })
})

describe('the default style types, as the page of typed styles shows them', () => {
  it('accept what the strict types reject, and still reject what is never a value', () => {
    const pageSheet = createMemorySheet()
    const { styled } = createStyle(
      { palette: { primary: '#1b5fd1' }, breakpoints: ['40em'] },
      { prefix: 'p', cache: createCache({ prefix: 'p', sheet: pageSheet }) }
    )

    // A value that was widened to string, where nothing typed the object.
    const card = { display: 'grid', alignItems: 'start' }
    styled('div')(card)

    // A key computed at run time.
    styled('div')(({ theme }) => ({
      gap: 8,
      [`@media (min-width: ${theme.breakpoints[0]})`]: { gap: 16 },
    }))

    // Any other key, with a nested style or a value: a misspelt key is not caught.
    styled('div')({ backgroudColor: 'red', '> li': { margin: 0 } })

    // React's CSSProperties in the style prop.
    const Box = styled('div')({ padding: 8 })
    const inline: CSSProperties = { marginTop: 4 }
    render(<Box style={inline} />)

    // @ts-expect-error a boolean is never a value
    styled('div')({ padding: true })
    // @ts-expect-error `label` is a string
    styled('div')({ label: 1 })
    expect(pageSheet.rules.join('')).toContain('margin-top:4px;')
  })
})
