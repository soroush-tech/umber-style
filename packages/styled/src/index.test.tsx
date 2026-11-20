import { render } from '@testing-library/react'
import { createCache, createMemorySheet } from '@umber-style/core'
import * as react from '@umber-style/react'
import styled, { type StyledComponent, type StyledOptions } from './index'

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
})
