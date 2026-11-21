import { createApp, createSSRApp, h, nextTick, ref, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createCache, createMemorySheet, createStyleTag, type Sheet } from '@umber-style/core'
import { createStyle } from './createStyle'

const theme = { palette: { primary: '#0000ff' } }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

function setup(sheet: Sheet = createMemorySheet()) {
  const style = createStyle(theme, {
    prefix: 'v',
    cache: createCache({ prefix: 'v', sheet, hasDevChecks: false }),
  })
  const Bar = style.styled('div', { name: 'Bar' })({ height: 4 })
  const rulesWith = (text: string) => sheet.rules.filter((rule) => rule.includes(text))
  return { ...style, sheet, Bar, rulesWith }
}

function mount(component: Component) {
  const element = document.createElement('div')
  const app = createApp(component)
  app.mount(element)
  return { element, unmount: () => app.unmount() }
}

const wait = () => vi.runAllTimers()

describe('a plain object in the style of a styled component, in Vue', () => {
  it('leaves one class of a hundred values that one element took', async () => {
    const { Bar, rulesWith } = setup()
    const width = ref(0)
    const { element } = mount(() => h(Bar, { style: { width: width.value } }))
    const bar = element.firstElementChild
    for (let value = 1; value < 100; value++) {
      width.value = value
      await nextTick()
      if (value % 10 === 0) wait()
    }
    wait()
    expect(rulesWith('width:')).toEqual([expect.stringContaining('width:99px')])
    expect(element.firstElementChild).toBe(bar)
    expect(bar?.hasAttribute('style')).toBe(false)
  })

  it('is one class for two elements, removed when the last one changes or unmounts', async () => {
    const { Bar, rulesWith } = setup()
    const first = ref(1)
    const second = ref(1)
    const shown = ref(true)
    const { element } = mount(() =>
      shown.value
        ? h('div', [
            h(Bar, { style: { width: first.value } }),
            h(Bar, { style: { width: second.value } }),
          ])
        : null
    )
    const [one, two] = [...(element.firstElementChild as Element).children]
    expect(one.className).toBe(two.className)
    first.value = 2
    await nextTick()
    wait()
    expect(rulesWith('width:1px')).toHaveLength(1)
    second.value = 2
    await nextTick()
    wait()
    expect(rulesWith('width:1px')).toEqual([])
    shown.value = false
    await nextTick()
    expect(rulesWith('width:2px')).toHaveLength(1)
    wait()
    expect(rulesWith('width:')).toEqual([])
  })

  it('is let go when the style no longer has an object, and held again when it has one', async () => {
    const { Bar, rulesWith } = setup()
    const style = ref<object | undefined>({ width: 1 })
    const { element, unmount } = mount(() => h(Bar, { style: style.value }))
    const bar = element.firstElementChild
    style.value = undefined
    await nextTick()
    wait()
    expect(rulesWith('width:')).toEqual([])
    expect(element.firstElementChild).toBe(bar)
    style.value = { width: 3 }
    await nextTick()
    wait()
    expect(rulesWith('width:3px')).toHaveLength(1)
    unmount()
    wait()
    expect(rulesWith('width:')).toEqual([])
  })

  it('keeps the own class of an entry, and holds a class on a component it renders', async () => {
    const { styled, StyleSheet, rulesWith } = setup()
    const sheet = StyleSheet.create({ red: { color: 'red' } })
    const Inner = { render: () => h('p', 'inner') }
    const Wrapped = styled(Inner)({ margin: 1 })
    const Bar = styled('div')({ height: 1 })
    const { unmount } = mount(() =>
      h('div', [h(Bar, { style: sheet.red }), h(Wrapped, { style: { width: 7 } })])
    )
    await nextTick()
    wait()
    expect(rulesWith('width:7px')).toHaveLength(1)
    unmount()
    wait()
    expect(rulesWith('width:')).toEqual([])
    expect(rulesWith('color:red')).toHaveLength(1)
  })

  it('stays with a sheet that cannot remove', () => {
    const rules: string[] = []
    const { Bar } = setup({ rules, insert: (rule) => void rules.push(rule) })
    mount(() => h(Bar, { style: { width: 1 } })).unmount()
    wait()
    expect(rules.filter((rule) => rule.includes('width:1px'))).toHaveLength(1)
  })

  it('is taken over from a server render, and removed from the page when the value changes', async () => {
    const server = setup()
    const html = await renderToString(createSSRApp(() => h(server.Bar, { style: { width: 5 } })))
    document.head.innerHTML = createStyleTag(server.cache)
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const pageRules = () =>
      [
        ...(
          (document.querySelector('style[data-style="v"]') as HTMLStyleElement)
            .sheet as CSSStyleSheet
        ).cssRules,
      ]
        .map((rule) => rule.cssText)
        .filter((text) => text.includes('width'))

    const { Bar, rulesWith } = setup()
    const width = ref(5)
    const app = createSSRApp(() => h(Bar, { style: { width: width.value } }))
    app.mount(container)
    wait()
    expect(rulesWith('width:')).toEqual([])
    expect(pageRules()).toHaveLength(1)
    width.value = 6
    await nextTick()
    wait()
    expect(pageRules()).toEqual([])
    expect(rulesWith('width:')).toEqual([expect.stringContaining('width:6px')])
    app.unmount()
  })
})

describe('the target option and the tag shorthands, in Vue', () => {
  it('add the target class, keep it in a wrapper, and make a component for each tag', () => {
    const { styled } = setup()
    const Card = styled('div', { name: 'Card', target: 'card' })({ color: 'red' })
    const Wide = styled(Card, { target: 'wide' })({ width: '100%' })
    const Empty = styled.span({})
    const Tagged = styled('i', { target: 'only' })()
    const { element } = mount(() =>
      h('div', [h(Card, { class: 'mine' }), h(Wide), h(Empty), h(Tagged)])
    )
    const [card, wide, empty, tagged] = [...(element.firstElementChild as Element).children]
    expect(card.className).toMatch(/^v-card-root-\w+ mine card$/)
    expect(wide.className).toMatch(/^v-[\w-]+ card wide$/)
    expect(empty.tagName).toBe('SPAN')
    expect(tagged.className).toBe('only')
  })
})
