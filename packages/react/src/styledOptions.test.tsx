import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createCache, createMemorySheet } from '@umber-style/core'
import { createStyle } from './createStyle'
import { createDefaultStyle } from './defaultStyle'
import { isDomProp } from './domProps'

const theme = { palette: { primary: '#0000ff' } }

function setup() {
  return createStyle(theme, {
    prefix: 'o',
    cache: createCache({ prefix: 'o', sheet: createMemorySheet() }),
  })
}

const only = (container: Element) => container.firstElementChild as Element

describe('the props that a string tag receives by default', () => {
  it('are the attributes of HTML, data-, aria- and event handlers, not the props of a component', () => {
    const { styled } = setup()
    const onClick = vi.fn()
    const Button = styled('button')<{ variant?: string; isActive?: boolean }>({ color: 'red' })
    const { container } = render(
      <Button
        variant="filled"
        isActive
        type="submit"
        disabled
        tabIndex={2}
        title="go"
        data-test="b"
        aria-label="go"
        onClick={onClick}
      />
    )
    const button = only(container) as HTMLButtonElement
    expect(button.getAttributeNames().sort()).toEqual([
      'aria-label',
      'class',
      'data-test',
      'disabled',
      'tabindex',
      'title',
      'type',
    ])
    button.click()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('are the attributes of SVG on an SVG tag', () => {
    const { styled } = setup()
    const Path = styled('path')<{ tone?: string }>({ fill: 'red' })
    const { container } = render(
      <svg>
        <Path d="M0 0" strokeWidth={2} fillOpacity={0.5} tone="x" xlinkHref="#a" />
      </svg>
    )
    const path = container.querySelector('path') as Element
    expect(path.getAttributeNames().sort()).toEqual([
      'class',
      'd',
      'fill-opacity',
      'stroke-width',
      'xlink:href',
    ])
  })

  it('are every prop for a component tag and for a custom element', () => {
    const { styled } = setup()
    const seen: Record<string, unknown>[] = []
    const Probe = (props: Record<string, unknown>) => {
      seen.push(props)
      return null
    }
    const Styled = styled(Probe)({ color: 'red' })
    render(<Styled tone="x" id="a" />)
    expect(seen[0]).toMatchObject({ tone: 'x', id: 'a' })
    const Custom = styled('my-element' as 'div')<{ tone?: string }>({ color: 'red' })
    const { container } = render(<Custom tone="x" />)
    expect(only(container).getAttribute('tone')).toBe('x')
  })

  it('are what shouldForwardProp says when it is given: it replaces the default', () => {
    const { styled } = setup()
    const Box = styled('div', { shouldForwardProp: (prop) => prop !== 'id' })<{ tone?: string }>({
      color: 'red',
    })
    const { container } = render(<Box tone="x" id="a" />)
    expect(only(container).getAttributeNames().sort()).toEqual(['class', 'tone'])
  })

  it('are listed with React names, the groups expanded', () => {
    for (const name of [
      'children',
      'dangerouslySetInnerHTML',
      'autoComplete',
      'htmlFor',
      'formNoValidate',
      'srcSet',
      'strokeDasharray',
      'k4',
      'in2',
      'xmlnsXlink',
      'shadowRootMode',
      'onPointerDownCapture',
    ]) {
      expect(isDomProp(name), name).toBe(true)
    }
    for (const name of ['variant', 'isActive', 'onclick', 'tone', 'sx', 'as2', 'datax']) {
      expect(isDomProp(name), name).toBe(false)
    }
  })
})

describe('the target option', () => {
  it('adds its class after the engine classes, and a wrapper keeps it with its own', () => {
    const { styled } = setup()
    const Card = styled('div', { name: 'Card', target: 'card' })({ color: 'red' })
    const Wide = styled(Card, { target: 'wide' })({ width: '100%' })
    const Empty = styled('span', { target: 'empty' })()
    const { container } = render(
      <>
        <Card className="mine" />
        <Wide />
        <Empty />
      </>
    )
    const [card, wide, empty] = [...container.children]
    expect(card.className).toMatch(/^o-card-root-\w+ mine card$/)
    expect(wide.className).toMatch(/^o-card-root-\w+ card wide$/)
    expect(empty.className).toBe('empty')
  })
})

describe('the tag shorthands', () => {
  it('are styled with the tag: styled.div, styled.svg, typed', () => {
    const { styled } = setup()
    const Box = styled.div<{ tone?: string }>(({ tone }) => ({ color: tone }))
    const Icon = styled.svg({ fill: 'red' })
    const { container } = render(
      <>
        <Box tone="red" id="b" />
        <Icon viewBox="0 0 1 1" />
      </>
    )
    const [box, icon] = [...container.children]
    expect(box.tagName).toBe('DIV')
    expect(box.id).toBe('b')
    expect(icon.tagName).toBe('svg')
    expect(icon.getAttribute('viewBox')).toBe('0 0 1 1')
    // @ts-expect-error a shorthand is a tag of HTML or SVG
    expect(() => styled.notATag()).not.toThrow()
  })

  it('are on the default style too', () => {
    const style = createDefaultStyle()
    style.configure({
      prefix: 'q',
      cache: createCache({ prefix: 'q', sheet: createMemorySheet() }),
    })
    const Box = style.styled.section({ color: 'red' })
    const { container } = render(<Box />)
    expect(only(container).tagName).toBe('SECTION')
    expect(only(container).className).toMatch(/^q-/)
  })
})

describe('the label option, and a function style that returns a list', () => {
  it('labels the class with the label as it is written, over name and slot', () => {
    const { styled } = setup()
    const AlertIcon = styled('span', { label: 'AlertIcon' })({ color: 'red' })
    const Named = styled('span', { name: 'Alert', slot: 'icon', label: 'AlertIcon' })({
      color: 'red',
    })
    const { container } = render(
      <>
        <AlertIcon />
        <Named />
      </>
    )
    const [first, second] = [...container.children].map((element) => element.className)
    expect(first).toMatch(/^o-AlertIcon-[a-z0-9]+$/)
    expect(second).toBe(first)
  })

  it('merges a list in order, as separate styles in that order', () => {
    const { styled, css, cache } = setup()
    const card = css({ padding: 8 })
    const Toggle = styled('div')<{ isOn?: boolean }>(({ isOn }) => [
      { color: 'red', margin: 1 },
      [null, isOn && { color: 'blue' }, [undefined, card]],
      false,
    ])
    const { container } = render(<Toggle isOn />)
    const className = only(container).className
    expect(className).toBe(cache.css({ color: 'red', margin: 1 }, { color: 'blue' }, card))
  })
})

describe('the label of a styled component that wraps a styled component', () => {
  const byVariant = ({ variant }: { variant?: string }) => ({ fontWeight: variant ? 700 : 400 })

  it('is the label of the wrapper on its base and its props class, and the inner label without one', () => {
    const { styled } = setup()
    const Typography = styled('span', { label: 'Typography' })({ margin: 0 }, byVariant)
    const Wrapper = styled(Typography, { label: 'W' })({ padding: 1 })
    const Named = styled(Typography, { name: 'Popover' })({ padding: 1 })
    const Plain = styled(Typography)({ padding: 1 })
    const { container } = render(
      <>
        <Typography variant="a" />
        <Wrapper variant="a" />
        <Named variant="a" />
        <Plain variant="a" />
      </>
    )
    const [typography, wrapper, named, plain] = [...container.children].map((element) =>
      element.className.split(' ')
    )
    expect(typography).toEqual([
      expect.stringMatching(/^o-Typography-\w+$/),
      expect.stringMatching(/^o-Typography-\w+$/),
    ])
    expect(wrapper).toEqual([
      typography[0].replace('Typography', 'W'),
      expect.stringMatching(/^o-W-\w+$/),
    ])
    expect(named.map((name) => name.replace(/-\w+$/, ''))).toEqual([
      'o-popover-root',
      'o-popover-root',
    ])
    expect(plain).toEqual([typography[0], expect.stringMatching(/^o-\w+$/)])
  })

  it('keeps the class of a wrapped component without functions in front, so that it is still a selector of the element', () => {
    const sheet = createMemorySheet()
    const { styled } = createStyle(theme, { cache: createCache({ prefix: 'o', sheet }) })
    const Paper = styled('div', { label: 'Paper' })({ margin: 0 })
    const Popover = styled(Paper, { label: 'Popover' })(byVariant)
    const Page = styled.main`
      ${Paper} {
        color: red;
      }
    `
    const { container } = render(
      <Page>
        <Paper />
        <Popover variant="a" />
      </Page>
    )
    const [paper, popover] = [...(container.firstElementChild as Element).children]
    const [selector, base, props] = popover.className.split(' ')
    expect(selector).toBe(paper.className)
    expect(`.${selector}`).toBe(String(Paper))
    expect(base).toBe(paper.className.replace('Paper', 'Popover'))
    expect(props).toMatch(/^o-Popover-\w+$/)
    expect(popover.matches(`main ${Paper}`)).toBe(true)
    expect(sheet.rules.join('')).toContain(`${Paper}{color:red;}`)
  })
})

describe('`as` on a styled component', () => {
  interface TypographyProps {
    as?: 'span' | 'a' | 'p'
    color?: string
    variant?: string
    className?: string
    href?: string
    children?: ReactNode
  }
  const join = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ')
  /** A component that is not made by `styled`: it takes `as` itself, and renders that tag with its own class. */
  const Typography = ({
    as: Tag = 'span',
    color,
    variant,
    className,
    ...rest
  }: TypographyProps) => (
    <Tag
      className={join(
        'typography',
        `typography-${variant}`,
        color && `typography-${color}`,
        className
      )}
      {...rest}
    />
  )

  it('is given to a component that is not made by styled, which is always rendered', () => {
    const { styled } = setup()
    const Link = styled(Typography, {
      shouldForwardProp: (prop) => prop !== 'underline',
    })<{ underline?: string }>(({ underline }) => ({ textDecoration: underline }))
    const { container } = render(
      <Link as="a" color="primary" variant="inherit" underline="always" href="#top">
        top
      </Link>
    )
    const link = only(container)
    expect(link.tagName).toBe('A')
    expect(link.getAttributeNames().sort()).toEqual(['class', 'href'])
    expect(link.className).toMatch(/^typography typography-inherit typography-primary o-\w+$/)
    expect(link.textContent).toBe('top')
  })

  it('is not given when shouldForwardProp keeps it, and a wrapper of the styled component gives it too', () => {
    const { styled } = setup()
    const Kept = styled(Typography, { shouldForwardProp: (prop) => prop !== 'as' })({ margin: 0 })
    const Link = styled(Typography)({ margin: 0 })
    const Wide = styled(Link, { label: 'Wide' })({ width: '100%' })
    const { container } = render(
      <>
        <Kept as="a" variant="body" />
        <Wide as="a" variant="body" />
      </>
    )
    const [kept, wide] = [...container.children]
    expect(kept.tagName).toBe('SPAN')
    expect(wide.tagName).toBe('A')
    expect(wide.className).toMatch(/^typography typography-body o-Wide-\w+$/)
  })

  it('replaces a string tag, also of a wrapped styled component, with the filter of the tag that is rendered', () => {
    const { styled } = setup()
    const Button = styled('button')<{ tone?: string }>({ color: 'red' })
    const Fancy = styled(Button)({ margin: 4 })
    const { container } = render(
      <>
        <Button as="a" tone="x" {...{ href: '#a' }} />
        <Fancy as="a" tone="x" {...{ href: '#b' }} />
      </>
    )
    for (const element of container.children) {
      expect(element.tagName).toBe('A')
      expect(element.getAttributeNames().sort()).toEqual(['class', 'href'])
    }
  })
})
