// @vitest-environment node
import * as vue from 'vue'
import { compileTemplate, parse } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import { createStyle } from './createStyle'

const theme = { palette: { primary: '#0000ff' } }

// A single-file component as a Vite app has it: its template uses styled components by name.
const SOURCE = `<template>
  <ThemeProvider :theme="theme">
    <Button :variant="variant">Save</Button>
    <ThemeProvider :theme="{ palette: { primary: '#ff0000' } }">
      <Button>Nested</Button>
    </ThemeProvider>
  </ThemeProvider>
</template>
`

/** The render function of the template of `source`, compiled by the compiler of single-file components. */
function compileRender(source: string): vue.RenderFunction {
  const { descriptor, errors } = parse(source, { filename: 'Card.vue' })
  expect(errors).toEqual([])
  const { code, errors: templateErrors } = compileTemplate({
    source: descriptor.template?.content ?? '',
    filename: 'Card.vue',
    id: 'card',
  })
  expect(templateErrors).toEqual([])
  // The module imports the helpers of Vue by name: they are handed to it, and its render is returned.
  const body = code
    .replace(/^import \{ ([^}]+) \} from "vue"/m, (_line, names: string) => {
      const pairs = names.split(',').map((name) => name.trim().replace(' as ', ': '))
      return `const { ${pairs.join(', ')} } = vue`
    })
    .replace('export function render', 'return function render')
  return new Function('vue', body)(vue) as vue.RenderFunction
}

describe('a single-file component with a template', () => {
  it('renders the styled components it names, with the class names that a render function gives', async () => {
    const style = createStyle(theme, { prefix: 'vt' })
    const Button = style.styled('button', { name: 'Button' })(({ theme: view, variant }) => ({
      color: view.palette.primary,
      fontWeight: variant === 'primary' ? 700 : 400,
    }))
    const components = { ThemeProvider: style.ThemeProvider, Button }
    const fromTemplate = vue.defineComponent({
      components,
      setup: () => ({ theme, variant: 'primary' }),
      render: compileRender(SOURCE),
    })
    const fromFunctions = () =>
      vue.h(style.ThemeProvider, { theme }, () => [
        vue.h(Button, { variant: 'primary' }, () => 'Save'),
        vue.h(style.ThemeProvider, { theme: { palette: { primary: '#ff0000' } } }, () =>
          vue.h(Button, null, () => 'Nested')
        ),
      ])
    const templateHtml = await renderToString(vue.createSSRApp(fromTemplate))
    const functionHtml = await renderToString(vue.createSSRApp(fromFunctions))
    const readClasses = (html: string) =>
      [...html.matchAll(/class="([^"]+)"/g)].map(([, name]) => name)
    expect(readClasses(templateHtml)).toEqual(readClasses(functionHtml))
    const classes = readClasses(templateHtml)
    expect(classes.filter((name) => name.startsWith('vt-button-root-'))).toHaveLength(2)
    expect(classes.some((name) => name.startsWith('vt-theme-'))).toBe(true)
    expect(templateHtml).not.toContain('style=')
  })
})
