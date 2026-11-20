import { createApp, h, type Component } from 'vue'
import { at, createCache, createMemorySheet, isSheetEntry } from '@umber-style/core'
import { createStyle } from './createStyle'
import type { FilteringStyledOptions, Keyframes, SerializedStyles, StyledComponent } from './index'

const theme = { palette: { primary: '#0000ff' } }

function setup() {
  const sheet = createMemorySheet()
  const style = createStyle(theme, { prefix: 'v', cache: createCache({ prefix: 'v', sheet }) })
  /** The rules of the class `className`, layer included. */
  const rulesOf = (className: string) =>
    sheet.rules.filter((rule) => rule.includes(`.${className}`))
  return { ...style, sheet, rulesOf }
}

function mount(component: Component) {
  const element = document.createElement('div')
  createApp(component).mount(element)
  return element.firstElementChild as HTMLElement
}

describe('css on Vue', () => {
  it('returns one sheet entry of the merged style, whose text is its class name', () => {
    const { css, sheet } = setup()
    const card: SerializedStyles = css({ color: 'red' }, [null, { padding: 8 }])
    expect(isSheetEntry(card)).toBe(true)
    expect(sheet.rules).toEqual([])
    const element = mount(() => h('p', { class: String(card) }))
    expect(element.className).toBe(card.className)
    expect(
      css`
        color: red;
        padding: 8px;
      `.className
    ).toBe(card.className)
  })

  it('is not a class when it is given to class as it is: Vue reads an object there as a map of names', () => {
    const { css, apply } = setup()
    const card = css({ color: 'red' })
    expect(mount(() => h('p', { class: card })).className).toBe('')
    expect(mount(() => h('p', { ...apply(card) })).className).toBe(card.className)
  })

  it('works in the style attribute of a styled component, alone or merged in a list, with no style attribute', () => {
    const { css, styled, rulesOf } = setup()
    const danger = css({ backgroundColor: 'firebrick' })
    const Button = styled('button')({ color: 'white' })
    const alone = mount(() => h(Button, { style: danger }))
    const override = alone.className.split(' ')[1]
    expect(rulesOf(override)).toEqual([
      `@layer v-overrides{.${override}{background-color:firebrick;}}`,
    ])
    const list = mount(() => h(Button, { style: [danger, { opacity: 0.5 }] }))
    const merged = list.className.split(' ')[1]
    expect(rulesOf(merged)).toEqual([
      `@layer v-overrides{.${merged}{background-color:firebrick;opacity:0.5;}}`,
    ])
    expect(list.hasAttribute('style')).toBe(false)
  })

  it('works inside another css(), in apply, among the styles of styled and under a global selector', () => {
    const { css, apply, styled, Global, sheet } = setup()
    const base = css({ margin: 0 })
    const loud = css(base, { color: 'blue' })
    expect(apply(loud).class).toBe(loud.className)
    const Box = styled('div')(base)
    expect(mount(() => h(Box)).className).toBe(base.className)
    mount(() => h('div', [h(Global, { styles: { body: base } })]))
    expect(sheet.rules).toContain('@layer v-global{body{margin:0;}}')
  })

  it('throws a TypeError for a function: there are no props', () => {
    const { css } = setup()
    expect(() => css((() => ({})) as never)).toThrow(TypeError)
  })
})

describe('the template form on Vue', () => {
  it('gives styled the CSS of the equal object, and a props class for a function of the attributes', () => {
    const { styled, rulesOf } = setup()
    const Template = styled('div')`
      color: red;
      &:hover {
        opacity: 0.8;
      }
    `
    const Object = styled('div')({ color: 'red', '&:hover': { opacity: 0.8 } })
    expect(mount(() => h(Template)).className).toBe(mount(() => h(Object)).className)
    const Title = styled.h1`
      color: ${({ tone }) => tone as string};
    `
    const red = mount(() => h(Title, { tone: 'red' })).className
    expect(mount(() => h(Title, { tone: 'blue' })).className).not.toBe(red)
    expect(rulesOf(red)).toEqual([`@layer v-components{.${red}{color:red;}}`])
  })

  it('makes a styled component a selector: its target, else its class, else a TypeError', () => {
    const { styled, rulesOf } = setup()
    const Icon: StyledComponent = styled('span', { target: 'icon' })(() => ({ color: 'red' }))
    const Button = styled('button')`
      ${Icon} {
        margin: 0;
      }
    `
    const button = mount(() => h(Button)).className
    expect(rulesOf(button)).toEqual([`@layer v-components{.${button} .icon{margin:0;}}`])
    const Plain = styled('span')({ color: 'red' })
    expect(String(Plain)).toBe(`.${mount(() => h(Plain)).className}`)
    const Other = styled('a')(at(`&:hover ${Plain}`, { margin: 1 }))
    expect(mount(() => h(Other)).className).toMatch(/^v-/)
    expect(() => String(styled('span')(() => ({ color: 'red' })))).toThrow(TypeError)
  })

  it('takes the template form of keyframes and globalStyles', () => {
    const { keyframes, globalStyles } = setup()
    const fade: Keyframes = keyframes`to { opacity: 1; }`
    expect(fade).toBe(keyframes({ to: { opacity: 1 } }))
    expect(globalStyles`body { margin: 0; }`.id).toBe(globalStyles({ body: { margin: '0' } }).id)
  })

  it('types a shouldForwardProp type guard', () => {
    const { styled } = setup()
    const options: FilteringStyledOptions<{ href: string; tone: string }, 'href'> = {
      shouldForwardProp: (prop): prop is 'href' => prop === 'href',
    }
    const Link = styled('a', options)({ color: 'red' })
    const element = mount(() => h(Link, { href: '#top', tone: 'loud' }))
    expect(element.getAttributeNames().sort()).toEqual(['class', 'href'])
  })
})
