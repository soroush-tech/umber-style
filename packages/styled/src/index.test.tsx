import { render } from '@testing-library/react'
import { createCache, createMemorySheet } from '@umber-style/core'
import * as react from '@umber-style/react'
import { expectTypeOf } from 'vitest'
import styled, {
  type CreateStyled,
  type CreateStyledComponent,
  type CSSObject,
  type FilteringStyledOptions,
  type Interpolation,
  type PropsOf,
  type StyledComponent,
  type StyledOptions,
  type Theme,
} from './index'

describe('the default export', () => {
  it('is the styled of the default style of the React binding, with its types and shorthands', () => {
    expect(styled).toBe(react.styled)
    expect('useTheme' in react).toBe(true)
    react.configure({
      prefix: 'st',
      cache: createCache({ prefix: 'st', sheet: createMemorySheet() }),
    })
    const options: StyledOptions = { name: 'Card', target: 'card' }
    const Card: StyledComponent<'div', { tone?: string }> = styled(
      'div',
      options
    )<{
      tone?: string
    }>(({ tone }) => ({ color: tone }))
    const Label = styled.span({ fontWeight: 600 })
    const { container } = render(
      <Card tone="red">
        <Label>x</Label>
      </Card>
    )
    const card = container.firstElementChild as HTMLElement
    expect(card.className).toMatch(/^st-card-root-\w+ card$/)
    expect(card.firstElementChild?.tagName).toBe('SPAN')
  })

  it('takes a template, and has the type names that apps import', () => {
    const Title = styled.h1`
      margin: 0;
    `
    const { container } = render(<Title>x</Title>)
    expect(container.firstElementChild?.className).toMatch(/^st-/)
    expectTypeOf(styled).toEqualTypeOf<CreateStyled<Theme>>()
    expectTypeOf<CSSObject>().toEqualTypeOf<react.CSSObject>()
    expectTypeOf<Interpolation>().toEqualTypeOf<react.Interpolation>()
    expectTypeOf<PropsOf<'a'>['href']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<FilteringStyledOptions>().toExtend<StyledOptions>()
    expectTypeOf<StyledOptions<PropsOf<'a'>>>().toEqualTypeOf<StyledOptions>()
    expectTypeOf<ReturnType<typeof styled<'a'>>>().toEqualTypeOf<
      CreateStyledComponent<object, PropsOf<'a'>>
    >()
  })

  it('has its tag shorthands as own members, which Object.assign copies to a wrapper', () => {
    const wrapper = Object.assign((tag: 'b') => styled(tag), styled)
    expect(Object.keys(styled)).toContain('section')
    const Strong = wrapper.b({ fontWeight: 700 })
    const { container } = render(<Strong>x</Strong>)
    expect(container.firstElementChild?.tagName).toBe('B')
    expect(container.firstElementChild?.className).toMatch(/^st-/)
  })
})
