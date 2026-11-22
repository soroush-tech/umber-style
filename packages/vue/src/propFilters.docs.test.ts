import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import isPropValid from '@umber-style/is-prop-valid/vue'
import { createStyle } from './createStyle'

// The Vue example of docs/prop-filters.md: the binding forwards every attribute by default, and the entry
// is given as shouldForwardProp.

const theme = { palette: { primary: '#1b5fd1', text: '#1a1a1a' } }

describe('the prop filter of the Vue entry, given as shouldForwardProp', () => {
  it('keeps the attributes that only the styles read off the element, and forwards the others', async () => {
    const { styled } = createStyle(theme, { prefix: 'umber' })

    const Box = styled('div', { shouldForwardProp: isPropValid })(({ tone }) => ({
      color: tone === 'primary' ? theme.palette.primary : theme.palette.text,
    }))

    const app = createSSRApp({
      render: () => h(Box, { tone: 'primary', tabindex: 0, onClick: () => {} }),
    })
    expect(await renderToString(app)).toMatch(/^<div tabindex="0" class="umber-[^"]+"><\/div>$/)
  })

  it('is not the default: without it, the element gets every attribute', async () => {
    const { styled } = createStyle(theme, { prefix: 'umber' })
    const Box = styled('div')({ margin: 0 })
    const html = await renderToString(createSSRApp({ render: () => h(Box, { tone: 'primary' }) }))
    expect(html).toMatch(/^<div tone="primary" class="umber-[^"]+"><\/div>$/)
  })
})
