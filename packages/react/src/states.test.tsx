import { render, screen } from '@testing-library/react'
import {
  at,
  createCache,
  createEngine,
  createMemorySheet,
  state,
  STATE_SELECTORS,
  type StateName,
  type StyleObject,
  type WebStyleObject,
} from '@umber-style/core'
import { bindEngine } from './createStyle'

const base = { palette: { primary: '#0000ff' } }
const dark = { palette: { primary: '#8888ff' } }
const NAMES: StateName[] = ['hovered', 'pressed', 'focused', 'disabled']

function setup() {
  const sheet = createMemorySheet()
  const engine = createEngine(base, {
    prefix: 'k',
    cache: createCache({ prefix: 'k', sheet }),
  })
  return { ...bindEngine(engine), sheet }
}

/** The class and the rules of a button styled with `style`, rendered by a fresh binding. */
function renderButton(style: StyleObject, label: string) {
  const { styled, sheet } = setup()
  // A style built in a loop is typed as the serializer reads it; the strict style types do not take that.
  const Button = styled('button')(style as WebStyleObject)
  render(<Button>{label}</Button>)
  return { className: screen.getByText(label).className, rules: [...sheet.rules] }
}

describe('state keys in the client build', () => {
  it('give each state the class and the rules of its selector written by hand', () => {
    for (const name of NAMES) {
      const byKey = renderButton(
        { opacity: 1, ...at(state(name), { opacity: 0.5 }) },
        `${name} key`
      )
      const byHand = renderButton(
        { opacity: 1, [STATE_SELECTORS[name]]: { opacity: 0.5 } },
        `${name} hand`
      )
      expect(byKey).toEqual(byHand)
    }
  })

  it('write the four selectors, in the order they are written, inside a condition too', () => {
    const { styled, when, sheet } = setup()
    const Button = styled('button')({
      opacity: 1,
      ...at(state('hovered'), { opacity: 0.9 }),
      ...at(state('pressed'), { opacity: 0.7 }),
      ...at(state('focused'), { outlineWidth: 2 }),
      ...at(state('disabled'), { opacity: 0.4 }),
      ...at(when(dark), { ...at(state('pressed'), { opacity: 0.6 }) }),
    })
    render(<Button>all</Button>)
    const name = screen.getByText('all').className
    const css = sheet.rules.join('')
    const order = [
      `.${name}:hover{opacity:0.9;}`,
      `.${name}:active{opacity:0.7;}`,
      `.${name}:focus-visible{outline-width:2px;}`,
      `.${name}:disabled,.${name}[aria-disabled="true"]{opacity:0.4;}`,
      `.${name}:active{opacity:0.6;}}`,
    ].map((rule) => css.indexOf(rule))
    expect(order.every((index) => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('keep the state props of the element: the selectors decide on the web', () => {
    const { styled } = setup()
    const Button = styled('button')({ ...at(state('disabled'), { opacity: 0.4 }) })
    render(<Button disabled>off</Button>)
    expect(screen.getByText('off')).toHaveProperty('disabled', true)
  })
})
