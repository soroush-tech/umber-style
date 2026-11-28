import { createApp, createSSRApp, defineComponent, h, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { at, createCache, createMemorySheet } from '@umber-style/core'
import { createStyle } from './createStyle'
import type { SheetEntry, SheetStyleProp, StyleProp, ThemedEntry } from './types'

const theme = { palette: { primary: '#0000ff' }, space: [0, 4, 8], breakpoints: ['900px'] }

function setup() {
  const sheet = createMemorySheet()
  const style = createStyle(theme, { prefix: 'b', cache: createCache({ prefix: 'b', sheet }) })
  return { ...style, rules: sheet.rules }
}

function mount(component: Component) {
  const element = document.createElement('div')
  createApp(component).mount(element)
  return element
}

/** A page of handles or of `useStyle` entries, under a provider and a nested one. */
function build(style: ReturnType<typeof setup>, kind: 'handle' | 'hook') {
  const { styled, StyleSheet, useStyle, ThemeProvider } = style
  const sheet = StyleSheet.create((view) => ({
    box: {
      color: view.palette.primary,
      ...at(`@media (width >= ${view.breakpoints[0]})`, { margin: 1 }),
    },
    raised: { opacity: 0.9 },
  }))
  const Static = styled('div')({ display: 'block' })
  const Dynamic = styled('div')(({ theme: view }) => ({ padding: view.space[1] }))
  const Probe = defineComponent({
    props: { id: { type: String, required: true } },
    setup(props) {
      const styles = useStyle(sheet)
      const entries = kind === 'handle' ? sheet : styles
      return () => [
        h(Static, { id: `${kind}-${props.id}-s`, style: entries.box }),
        h(Dynamic, { id: `${kind}-${props.id}-d`, style: entries.box }),
        // Vue merges a list into one object: the handle is found again by its key.
        h(Static, {
          id: `${kind}-${props.id}-l`,
          style: [entries.box, false, null, entries.raised, { width: '1px' }],
        }),
      ]
    },
  })
  return () =>
    h(ThemeProvider, { theme }, () => [
      h(Probe, { id: 'outer' }),
      h(ThemeProvider, { theme: { breakpoints: ['500px'] } }, () => h(Probe, { id: 'nested' })),
    ])
}

describe('style of a handle of a sheet made from a function of the theme, on Vue', () => {
  it('gives the class and the rules of useStyle(sheet).key under nested providers, alone and in lists', () => {
    const withHandles = setup()
    const withHook = setup()
    const handles = mount(build(withHandles, 'handle'))
    const hook = mount(build(withHook, 'hook'))
    const cls = (root: HTMLElement, id: string) =>
      (root.querySelector(`#${id}`) as HTMLElement).className
    for (const id of ['outer', 'nested']) {
      for (const kind of ['s', 'd', 'l']) {
        expect(cls(handles, `handle-${id}-${kind}`)).toBe(cls(hook, `hook-${id}-${kind}`))
        expect(handles.querySelector(`#handle-${id}-${kind}`)?.getAttribute('style')).toBeNull()
      }
    }
    expect(cls(handles, 'handle-outer-s')).not.toBe(cls(handles, 'handle-nested-s'))
    expect(withHandles.rules).toEqual(withHook.rules)
  })

  it('gives the same classes on a server render', async () => {
    const html = await renderToString(createSSRApp(build(setup(), 'handle')))
    const hook = await renderToString(createSSRApp(build(setup(), 'hook')))
    expect(html.replaceAll('handle-', '')).toBe(hook.replaceAll('hook-', ''))
    expect(html).not.toContain('style=')
  })

  it('is a TypeError in apply and css()', () => {
    const { StyleSheet, apply, css } = setup()
    const sheet = StyleSheet.create((view) => ({ box: { color: view.palette.primary } }))
    expect(() => apply(sheet.box as never)).toThrow(/^apply\(\): /)
    expect(() => css(sheet.box as never)).toThrow(/^css\(\): /)
  })
})

describe('the slot pattern on Vue', () => {
  it('gives each part its entry, from handles and from entries, within one side', () => {
    const style = setup()
    const sheet = style.StyleSheet.create((view) => ({
      root: { padding: view.space[2] },
      avatar: { color: view.palette.primary },
    }))
    const Root = style.styled('section', { name: 'Card' })({ display: 'grid' })
    const Avatar = style.styled('img', { name: 'Card', slot: 'avatar' })({ borderRadius: '4px' })
    const Card = defineComponent({
      props: {
        id: { type: String, required: true },
        styleProps: { type: Object as () => Record<string, SheetStyleProp>, default: () => ({}) },
      },
      setup(props) {
        return () =>
          h(Root, { id: `${props.id}-root`, style: props.styleProps.root }, () =>
            h(Avatar, { id: `${props.id}-avatar`, style: props.styleProps.avatar })
          )
      },
    })
    const Page = defineComponent({
      setup() {
        const styles = style.useStyle(sheet)
        return () => [
          h(Card, { id: 'handle', styleProps: { root: sheet.root, avatar: sheet.avatar } }),
          h(Card, { id: 'hook', styleProps: { root: styles.root, avatar: styles.avatar } }),
        ]
      },
    })
    const root = mount(() => h(style.ThemeProvider, { theme }, () => h(Page)))
    const cls = (id: string) => (root.querySelector(`#${id}`) as HTMLElement).className
    for (const part of ['root', 'avatar']) {
      expect(cls(`handle-${part}`)).toBe(cls(`hook-${part}`))
    }
  })
})

describe('the types of a handle and of the style props on Vue', () => {
  it('types sheet.key as a handle, and SheetStyleProp as entries only', () => {
    const { StyleSheet, css } = setup()
    const object = StyleSheet.create({ a: { color: 'red' } })
    const themed = StyleSheet.create((view) => ({ b: { color: view.palette.primary } }))
    expectTypeOf(themed.b).toEqualTypeOf<ThemedEntry>()
    // @ts-expect-error a name that the sheet does not have
    expect(themed.missing).toBeDefined()
    const accepted: SheetStyleProp[] = [
      object.a,
      themed.b,
      [object.a, [themed.b, false]],
      null,
      css({}),
    ]
    const asStyle: StyleProp = [accepted, { opacity: 1 }]
    // @ts-expect-error a plain object
    const plain: SheetStyleProp = { color: 'red' }
    // @ts-expect-error a string
    const text: StyleProp = 'x'
    expectTypeOf(object.a).toEqualTypeOf<SheetEntry>()
    expect([asStyle, plain, text]).toBeDefined()
  })
})
