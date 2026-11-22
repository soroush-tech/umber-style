import { render } from '@testing-library/react'
import { createElement } from 'react'
import { createApp, h } from 'vue'
import { createCache, createMemorySheet } from './index'
import { createStyle as createWebStyle } from './react'
import { createStyle as createNativeStyle } from './react-native'
import type { SharedStyle, SharedStyleObject } from './shared'
import { createStyle as createVueStyle } from './vue'

const theme = { palette: { text: '#111111' } }
type AppTheme = typeof theme

/** The one source: an animation, global styles and the style of an animated component, made with the names of the binding it runs on. */
function createSource({
  keyframes,
  globalStyles,
}: Pick<SharedStyle<AppTheme>, 'keyframes' | 'globalStyles'>) {
  const pulse = keyframes(
    { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
    { label: 'pulse' }
  )
  const base = globalStyles((view) => ({ body: { margin: 0, color: view.palette.text } }))
  const skeleton: SharedStyleObject = {
    opacity: 1,
    web: { animation: `${pulse} 1.5s ease-in-out infinite` },
  }
  return { pulse, base, skeleton }
}

/** A cache over an in-memory sheet without layers, and the sheet. */
function createMemoryCache(prefix: string) {
  const sheet = createMemorySheet()
  return { sheet, cache: createCache({ prefix, sheet, hasLayers: false }) }
}

/** That `rules` are `expected`, in any order: a class and a global rule are in different layers, and their order is the order of writing, which differs between frameworks. */
function expectRules(rules: readonly string[], expected: string[]) {
  expect([...rules].sort()).toEqual([...expected].sort())
}

describe('one source with keyframes and Global', () => {
  it('writes the animation, the global rules and the animated class with React on the web', () => {
    const { sheet, cache } = createMemoryCache('w')
    const web = createWebStyle(theme, { prefix: 'w', cache })
    const { pulse, base, skeleton } = createSource(web)
    const Skeleton = web.styled('div')(skeleton)
    const { container } = render(
      <>
        <web.Global styles={base} />
        <Skeleton />
      </>
    )
    expectRules(sheet.rules, [
      'body{margin:0;color:var(--w-palette-text);}',
      `@keyframes ${pulse}{0%{opacity:1;}50%{opacity:0.4;}100%{opacity:1;}}`,
      `.${container.firstElementChild?.className}{opacity:1;animation:${pulse} 1.5s ease-in-out infinite;}`,
    ])
  })

  it('writes the same with Vue', () => {
    const { sheet, cache } = createMemoryCache('v')
    const vue = createVueStyle(theme, { prefix: 'v', cache })
    const { pulse, base, skeleton } = createSource(vue)
    const Skeleton = vue.styled('div')(skeleton)
    const element = document.createElement('div')
    createApp(() => [h(vue.Global, { styles: base }), h(Skeleton)]).mount(element)
    expectRules(sheet.rules, [
      'body{margin:0;color:var(--v-palette-text);}',
      `@keyframes ${pulse}{0%{opacity:1;}50%{opacity:0.4;}100%{opacity:1;}}`,
      `.${element.querySelector('div')?.className}{opacity:1;animation:${pulse} 1.5s ease-in-out infinite;}`,
    ])
  })

  it('gives the same name on React Native, renders nothing for Global, and runs no animation', () => {
    const native = createNativeStyle(theme)
    const { pulse, base, skeleton } = createSource(native)
    expect(pulse).toBe(createSource(createWebStyle(theme)).pulse)
    const calls: Record<string, unknown>[] = []
    const View = (props: Record<string, unknown>) => {
      calls.push(props)
      return createElement('view')
    }
    const Skeleton = native.styled(View)(skeleton as never)
    const { container } = render(
      <>
        <native.Global styles={base} />
        <Skeleton />
      </>
    )
    expect(container.innerHTML).toBe('<view></view>')
    expect(calls[0].style).toEqual([{ opacity: 1 }])
  })
})
