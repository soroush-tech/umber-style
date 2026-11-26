// @vitest-environment node
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createStyle } from './createStyle'

const baseTheme = { palette: { primary: '#0000ff', text: '#111111' } }
type AppTheme = typeof baseTheme

describe('the functions of a Vue app, on the server', () => {
  it('give the style functions of an element one argument, and each element its own', async () => {
    const { styled } = createStyle(baseTheme, { prefix: 'va' })
    const seen: object[][] = []
    const Box = styled('div', { name: 'Box' })(
      (argument) => {
        seen.push([argument])
        return { color: argument.tone as string }
      },
      (argument) => {
        seen.at(-1)?.push(argument)
        return { borderColor: argument.theme.palette.text }
      }
    )
    await renderToString(createSSRApp(() => [h(Box, { tone: 'red' }), h(Box, { tone: 'blue' })]))
    const renders = seen.filter((pair) => pair.length === 2)
    expect(renders).toHaveLength(2)
    for (const [one, other] of renders) expect(one).toBe(other)
    expect(renders[0][0]).not.toBe(renders[1][0])
  })

  it('in development, throw on a write into the theme from a provider function and into the argument', async () => {
    const { styled, ThemeProvider } = createStyle(baseTheme, { prefix: 'vb', hasDevChecks: true })
    const provided = createSSRApp(() =>
      h(
        ThemeProvider,
        {
          theme: (outer: AppTheme) => {
            outer.palette.text = '#000000'
            return {}
          },
        },
        () => h('i')
      )
    )
    await expect(renderToString(provided)).rejects.toThrow(
      '[vb] theme.palette.text is set by a function of "ThemeProvider".'
    )
    const Box = styled('div', { name: 'Box' })((argument) => {
      ;(argument as { tone?: string }).tone = 'red'
      return null
    })
    await expect(renderToString(createSSRApp(() => h(Box)))).rejects.toThrow(
      new TypeError(
        '[vb] A style function of "box-root" threw a TypeError of a write into a frozen object: Cannot define property tone, object is not extensible. In development the argument of a style function is frozen: it is one object, the props with the theme, shared by the style functions of the element in a render. Copy the argument before changing it: const own = { ...props }.'
      )
    )
    expect(baseTheme.palette.text).toBe('#111111')
  })

  it('in production, give a provider function the theme above itself', async () => {
    const { ThemeProvider } = createStyle(baseTheme, { prefix: 'vc', hasDevChecks: false })
    let given: unknown
    await renderToString(
      createSSRApp(() =>
        h(
          ThemeProvider,
          {
            theme: (outer: AppTheme) => {
              given = outer
              return {}
            },
          },
          () => h('i')
        )
      )
    )
    expect(given).toBe(baseTheme)
  })
})
