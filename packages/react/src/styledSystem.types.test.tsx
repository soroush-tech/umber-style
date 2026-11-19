// styled-system parsers are functions of the props that return a loosely typed object: the web `styled`
// takes them as they are. `pnpm typecheck` compiles this file.
import { render } from '@testing-library/react'
import { system } from '@soroush.tech/styled-system/core'
import { space, type SpaceProps } from '@soroush.tech/styled-system/space'
import { variant } from '@soroush.tech/styled-system/variant'
import { createCache, createMemorySheet } from '@umber-style/core'
import { expectTypeOf } from 'vitest'
import { createStyle } from './createStyle'

const sheet = createMemorySheet()
const { styled } = createStyle(
  { space: [0, 4, 8], palette: { primary: '#0000ff' } },
  { prefix: 's', cache: createCache({ prefix: 's', sheet }) }
)

describe('styled-system parsers as style functions, without a cast', () => {
  it('takes a parser, a parser made with system() and a variant', () => {
    const color = system({ color: { property: 'color', scale: 'palette' } })
    const kind = variant({ prop: 'kind', variants: { filled: { color: 'primary' } } })
    const Box = styled('div')<SpaceProps>(space)
    const Colored = styled('div')(color)
    const Button = styled('button')(kind, space, { '&:hover': { opacity: 0.8 } })
    expectTypeOf(Box).toBeFunction()
    render(
      <>
        <Box p={1} />
        <Colored />
        <Button />
      </>
    )
    expect(sheet.rules.join('')).toContain('padding:var(--s-space-1);')
  })

  it('still checks an object next to a parser', () => {
    // @ts-expect-error a misspelt property next to a parser
    const Typo = styled('div')(space, { backgroudColor: 'red' })
    expectTypeOf(Typo).toBeFunction()
  })
})
