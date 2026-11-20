import { createCache, createEngine, createMemorySheet } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import { findAll, resolveTree } from './vitest.resolveTree'
import type { CacheFunction } from './serverContext'

const theme = { palette: { primary: '#0000ff' } }

const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

function setup() {
  const sheet = createMemorySheet()
  const engine = createEngine(theme, {
    prefix: 's',
    cache: createCache({ prefix: 's', sheet }),
  })
  return { ...bindEngine(engine, requestCache), sheet }
}

describe('styled in the server components build', () => {
  it('has the tag shorthands, the target, and the default filter of a string tag', async () => {
    const { styled } = setup()
    const Box = styled.div<{ tone?: string }>({ color: 'red' })
    const Card = styled('section', { target: 'card' })({ margin: 1 })
    const tree = await resolveTree(
      <>
        <Box tone="x" id="b" />
        <Card />
      </>
    )
    const [box] = findAll(tree, 'div')
    expect(box.props).toEqual({ id: 'b', className: expect.stringMatching(/^s-\w+$/) })
    const [card] = findAll(tree, 'section')
    expect(card.props.className).toMatch(/^s-\w+ card$/)
  })

  it('writes the class of a plain object in style for good: nothing is held or removed', async () => {
    vi.useFakeTimers()
    const { styled, sheet } = setup()
    const Bar = styled.div({ height: 1 })
    const tree = await resolveTree(<Bar style={{ width: 5 }} />)
    vi.runAllTimers()
    vi.useRealTimers()
    const [bar] = findAll(tree, 'div')
    const override = (bar.props.className as string).split(' ')[1]
    expect(sheet.rules.filter((rule) => rule.includes(override))).toHaveLength(1)
  })
})
