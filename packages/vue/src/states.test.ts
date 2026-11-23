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
import { createApp, h } from 'vue'
import { bindEngine } from './createStyle'

const base = { palette: { primary: '#0000ff' } }
const NAMES: StateName[] = ['hovered', 'pressed', 'focused', 'disabled']

/** The class and the rules of a button styled with `style`, mounted by a fresh binding. */
function mountButton(style: StyleObject) {
  const sheet = createMemorySheet()
  const engine = createEngine(base, { prefix: 'v', cache: createCache({ prefix: 'v', sheet }) })
  const { styled } = bindEngine(engine)
  // A style built in a loop is typed as the serializer reads it; the strict style types do not take that.
  const Button = styled('button')(style as WebStyleObject)
  const root = document.createElement('div')
  createApp(() => h(Button)).mount(root)
  return { className: root.firstElementChild?.className, rules: [...sheet.rules] }
}

describe('state keys in Vue', () => {
  it('give each state the class and the rules of its selector written by hand', () => {
    for (const name of NAMES) {
      const byKey = mountButton({ opacity: 1, ...at(state(name), { opacity: 0.5 }) })
      const byHand = mountButton({ opacity: 1, [STATE_SELECTORS[name]]: { opacity: 0.5 } })
      expect(byKey).toEqual(byHand)
    }
    const { className, rules } = mountButton({ ...at(state('disabled'), { opacity: 0.4 }) })
    expect(rules.join('')).toContain(
      `.${className}:disabled,.${className}[aria-disabled="true"]{opacity:0.4;}`
    )
  })
})
