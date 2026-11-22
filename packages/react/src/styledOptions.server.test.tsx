import { createCache, createEngine, createMemorySheet } from '@umber-style/core'
import type { ReactNode } from 'react'
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

  it('labels the base and the props class of a wrapper of a styled component with the label of the wrapper', async () => {
    const { styled } = setup()
    const byVariant = ({ variant }: { variant?: string }) => ({ fontWeight: variant ? 700 : 400 })
    const Typography = styled('span', { label: 'Typography' })({ margin: 0 }, byVariant)
    const Wrapper = styled(Typography, { label: 'W' })({ padding: 1 })
    const tree = await resolveTree(
      <>
        <Typography variant="a" />
        <Wrapper variant="a" />
      </>
    )
    const [typography, wrapper] = findAll(tree, 'span').map((span) =>
      (span.props.className as string).split(' ')
    )
    expect(typography[0]).toMatch(/^s-Typography-\w+$/)
    expect(wrapper).toEqual([
      typography[0].replace('Typography', 'W'),
      expect.stringMatching(/^s-W-\w+$/),
    ])
  })

  it('gives `as` to a component that is not made by styled, and replaces a string tag with it', async () => {
    const { styled } = setup()
    const Typography = ({
      as: Tag = 'span',
      color: _color,
      variant,
      className,
      ...rest
    }: {
      as?: 'span' | 'a'
      color?: string
      variant?: string
      className?: string
      href?: string
      children?: ReactNode
    }) => <Tag className={`typography-${variant} ${className}`} {...rest} />
    const Link = styled(Typography, {
      shouldForwardProp: (prop) => prop !== 'underline',
    })<{ underline?: string }>(({ underline }) => ({ textDecoration: underline }))
    const Button = styled('button')<{ tone?: string }>({ color: 'red' })
    const tree = await resolveTree(
      <>
        <Link as="a" color="primary" variant="inherit" underline="always" href="#top" />
        <Button as="a" tone="x" {...{ href: '#b' }} />
      </>
    )
    const [link, button] = findAll(tree, 'a')
    expect(link.props).toEqual({
      href: '#top',
      className: expect.stringMatching(/^typography-inherit s-\w+$/),
    })
    expect(button.props).toEqual({ href: '#b', className: expect.stringMatching(/^s-\w+$/) })
  })
})
