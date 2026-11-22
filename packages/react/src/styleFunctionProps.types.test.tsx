// What a function style reads when the props of the type argument and of the tag share keys, and when
// they do not: the types take a cheaper path where they share none, and these cases hold on each path.
// `pnpm typecheck` compiles this file with the default and with the strict style types; the run checks
// that each style function is called with the props given to the element.
import { render } from '@testing-library/react'
import { createCache, createMemorySheet } from '@umber-style/core'
import { expectTypeOf } from 'vitest'
import { createStyle } from './createStyle'

const sheet = createMemorySheet()
const { styled } = createStyle(
  { space: ['0px', '4px'] },
  { prefix: 'f', cache: createCache({ prefix: 'f', sheet }) }
)

describe('the props that a function style reads', () => {
  it('are the props of the tag as they are, with props of its own that the tag does not have', () => {
    const seen: string[] = []
    const Note = styled('p')<{ tone?: 'info' | 'danger' }>(({ theme, tone, id }) => {
      expectTypeOf(tone).toEqualTypeOf<'info' | 'danger' | undefined>()
      expectTypeOf(id).toEqualTypeOf<string | undefined>()
      seen.push(`${tone}:${id}`)
      return { margin: theme.space[1] }
    })
    render(<Note tone="danger" id="note" />)
    expect(seen.at(-1)).toBe('danger:note')
  })

  it('give a prop that the tag has too the type of the type argument, not an intersection', () => {
    const seen: string[] = []
    const Field = styled('input')<{ size: 'small' | 'large' }>(({ size, name }) => {
      expectTypeOf(size).toEqualTypeOf<'small' | 'large'>()
      expectTypeOf(name).toEqualTypeOf<string | undefined>()
      seen.push(`${size}:${name}`)
      return { width: size === 'small' ? 40 : 80 }
    })
    render(<Field size="large" name="field" />)
    expect(seen.at(-1)).toBe('large:field')
  })

  it('give the props of the tag that an index signature of the type argument matches its type', () => {
    const seen: unknown[] = []
    const Cell = styled('td')<{ [key: string]: number }>((props) => {
      expectTypeOf(props.colSpan).toEqualTypeOf<number>()
      seen.push(props.colSpan)
      return null
    })
    render(
      <table>
        <tbody>
          <tr>
            <Cell colSpan={2} />
          </tr>
        </tbody>
      </table>
    )
    expect(seen.at(-1)).toBe(2)
  })
})
