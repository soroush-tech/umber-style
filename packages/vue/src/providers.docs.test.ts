// @vitest-environment node
// The examples of docs/vue.md about the providers: the markup that the page shows is asserted here.
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createStyle } from './createStyle'

const theme = { palette: { primary: '#1b5fd1', onPrimary: '#ffffff' }, space: [0, 4, 8, 16] }

describe('the examples of docs/vue.md', () => {
  it('renders no element for the outermost provider, and the wrapper of a nested one', async () => {
    const { styled, StyleSheet, useStyle, useTheme, ThemeProvider } = createStyle(theme, {
      prefix: 'umber',
    })
    const sheet = StyleSheet.create((view) => ({
      box: { padding: view.space[2] },
      active: { backgroundColor: view.palette.primary },
    }))
    const Card = styled('div', { name: 'Card' })({ color: 'inherit' })
    const Box = defineComponent({
      props: { isActive: Boolean },
      setup(props) {
        const styles = useStyle(sheet)
        const current = useTheme()
        return () =>
          h(
            Card,
            { style: [styles.box, props.isActive && styles.active] },
            () => current.value.palette.primary
          )
      },
    })
    const page = createSSRApp({
      render: () => h(ThemeProvider, { theme }, () => h(Box, { isActive: true })),
    })
    expect(await renderToString(page)).toBe(
      '<!--[--><div class="umber-card-root-1l5hymm umber-card-root-o63tmj">#1b5fd1</div><!--]-->'
    )
    const nested = createSSRApp({
      render: () =>
        h(ThemeProvider, { theme }, () =>
          h(ThemeProvider, {
            theme: { palette: { primary: '#c2410c' } },
            as: 'section',
            class: 'mine',
          })
        ),
    })
    expect(await renderToString(nested)).toBe(
      '<!--[--><section class="umber-theme-1an5zox umber-boundary umber-theme-1be996m umber-scope mine"></section><!--]-->'
    )
  })
})
