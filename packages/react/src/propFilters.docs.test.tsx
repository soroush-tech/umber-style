import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import isPropValid from '@umber-style/is-prop-valid/react'
import { createStyle } from './createStyle'

// The React examples of docs/prop-filters.md.

const theme = { palette: { primary: '#1b5fd1', text: '#1a1a1a' } }

describe('the prop filter of the React entry, given as shouldForwardProp', () => {
  it('keeps the props of a component off the component it wraps, and forwards its attributes', () => {
    const { styled } = createStyle(theme, { prefix: 'umber', hasServerStyleElements: false })

    function Anchor(props: ComponentProps<'a'>) {
      return <a {...props} />
    }

    const Link = styled(Anchor, { shouldForwardProp: isPropValid })<{ tone?: 'primary' }>(
      ({ theme, tone }) => ({ color: tone === 'primary' ? theme.palette.primary : 'inherit' })
    )
    const html = renderToStaticMarkup(<Link tone="primary" href="/docs" />)
    expect(html).toMatch(/^<a href="\/docs" class="umber-[^"]+"><\/a>$/)
  })

  it('makes a filter of its own with a rule of the component', () => {
    const { styled } = createStyle(theme, { prefix: 'umber', hasServerStyleElements: false })

    const Swatch = styled('div', {
      shouldForwardProp: (prop) => isPropValid(prop) && prop !== 'color',
    })<{ color?: string }>(({ color }) => ({ backgroundColor: color }))
    const html = renderToStaticMarkup(<Swatch color="#c2410c" title="orange" />)
    expect(html).toMatch(/^<div title="orange" class="umber-[^"]+"><\/div>$/)
  })
})
