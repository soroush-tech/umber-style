import { render } from '@testing-library/react'
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
