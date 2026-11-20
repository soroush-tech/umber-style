// The type names that apps import, in the forms a design system writes them. `pnpm typecheck` compiles
// this file; the run checks that the values behind the types work.
import { render, screen } from '@testing-library/react'
import { createCache, createMemorySheet } from '@umber-style/core'
import type { ComponentProps } from 'react'
import { expectTypeOf } from 'vitest'
import { createStyle } from './createStyle'
import type {
  CreateStyled,
  CSSObject,
  FilteringStyledOptions,
  Interpolation,
  Keyframes,
  PropsOf,
  SerializedStyles,
  StyledComponent,
  StyledOptions,
  Theme,
  UmberCache,
} from './index'

const theme = { palette: { primary: '#0000ff' }, radii: { card: 8 } }
type AppTheme = typeof theme

function setup() {
  const sheet = createMemorySheet()
  const style = createStyle(theme, { prefix: 't', cache: createCache({ prefix: 't', sheet }) })
  return { ...style, sheet }
}

describe('the type names that apps import', () => {
  it('types a style object, and still catches a misspelt key in it', () => {
    const { styled } = setup()
    const card: CSSObject = { padding: 8, '&:hover': { opacity: 0.8 } }
    // @ts-expect-error a misspelt key
    const typo: CSSObject = { backgroudColor: 'red' }
    const Card = styled('div')(card)
    render(<Card data-testid="card" />)
    expect(screen.getByTestId('card').className).toMatch(/^t-/)
    expectTypeOf(typo).toEqualTypeOf<CSSObject>()
  })

  it('types a styled component with props of its own', () => {
    const { styled } = setup()
    interface ButtonProps {
      tone: 'primary' | 'danger'
    }
    const Button: StyledComponent<'button', ButtonProps> = styled('button')<ButtonProps>(
      ({ theme: view, tone }) => ({
        color: tone === 'primary' ? view.palette.primary : 'firebrick',
      })
    )
    render(
      <Button data-testid="button" tone="danger" type="submit">
        Go
      </Button>
    )
    // @ts-expect-error a prop of its own is required
    const missing = <Button />
    expect(missing.type).toBe(Button)
    expect(screen.getByTestId('button').getAttribute('type')).toBe('submit')
    expectTypeOf<PropsOf<typeof Button>['tone']>().toEqualTypeOf<'primary' | 'danger'>()
  })

  it('narrows the props of the tag to what a shouldForwardProp type guard names', () => {
    const { styled } = setup()
    const options = {
      shouldForwardProp: (prop: string): prop is 'href' | 'children' =>
        prop === 'href' || prop === 'children',
    } satisfies FilteringStyledOptions<ComponentProps<'a'>, 'href' | 'children'>
    const Link = styled(
      'a',
      options
    )<{ isActive?: boolean }>(({ isActive }) => ({
      fontWeight: isActive ? 'bold' : 'normal',
    }))
    const { container } = render(
      <Link href="#top" isActive>
        Top
      </Link>
    )
    // @ts-expect-error `title` is not forwarded, so it is not a prop
    const dropped = <Link title="x" />
    expect(dropped.type).toBe(Link)
    const link = container.querySelector('a') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('#top')
    expect(link.getAttributeNames().sort()).toEqual(['class', 'href'])
    // A filter that is not a type guard keeps every prop of the tag.
    const plain: StyledOptions = { shouldForwardProp: (prop): boolean => prop !== 'isActive' }
    const Plain = styled('a', plain)({ color: 'red' })
    const kept = <Plain title="kept" />
    expect(kept.props.title).toBe('kept')
  })

  it('types a css() result that is passed around, and a list of styles', () => {
    const { css, styled, apply } = setup()
    const card: SerializedStyles = css({ padding: 8 })
    const styles: Interpolation<{ isOn: boolean }, AppTheme>[] = [
      card,
      ({ isOn, theme: view }) => isOn && { color: view.palette.primary },
      [false, { margin: 0 }],
    ]
    const Box = styled('div')<{ isOn: boolean }>(...styles)
    render(<Box data-testid="box" isOn style={card} />)
    expect(apply(card).className).toBe(card.className)
    expect(screen.getByTestId('box').className.split(' ')).toHaveLength(3)
    // @ts-expect-error css() takes no function: there are no props
    expect(() => css(() => ({ color: 'red' }))).toThrow(TypeError)
  })

  it('types a keyframes result as a string', () => {
    const { keyframes } = setup()
    const fade: Keyframes = keyframes({ from: { opacity: 0 } })
    const spin: Keyframes = keyframes`to { transform: rotate(360deg); }`
    const name: string = fade
    expect(name).toMatch(/^keyframes-/)
    expect(spin).toMatch(/^keyframes-/)
  })

  it('types a cache, and the type of styled', () => {
    const typed: UmberCache | undefined = undefined
    expectTypeOf<UmberCache>().toExtend<NonNullable<Parameters<typeof createStyle>[1]>['cache']>()
    const { styled } = setup()
    const made: CreateStyled<AppTheme> = styled
    expect(made).toBe(styled)
    expect(typed).toBeUndefined()
    expectTypeOf<Theme>().toHaveProperty('_theme')
  })
})
