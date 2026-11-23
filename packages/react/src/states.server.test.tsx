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
import { bindEngine } from './createStyle.server'
import { findAll, resolveTree } from './vitest.resolveTree'
import type { CacheFunction } from './serverContext'

const base = { palette: { primary: '#0000ff' } }
const NAMES: StateName[] = ['hovered', 'pressed', 'focused', 'disabled']

const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

/** The class of a button styled with `style` in the server build, and the CSS it sends with it. */
async function renderButton(style: StyleObject) {
  const engine = createEngine(base, {
    prefix: 's',
    cache: createCache({ prefix: 's', sheet: createMemorySheet() }),
  })
  const { styled } = bindEngine(engine, requestCache)
  // A style built in a loop is typed as the serializer reads it; the strict style types do not take that.
  const Button = styled('button')(style as WebStyleObject)
  const tree = await resolveTree(<Button>x</Button>)
  const [button] = findAll(tree, 'button')
  const css = findAll(tree, 'style')
    .map((element) => element.children.join(''))
    .join('')
  return { className: button.props.className as string, css }
}

describe('state keys in the server build', () => {
  it('send the class and the CSS of the selector written by hand, as the client build does', async () => {
    for (const name of NAMES) {
      const byKey = await renderButton({ opacity: 1, ...at(state(name), { opacity: 0.5 }) })
      const byHand = await renderButton({ opacity: 1, [STATE_SELECTORS[name]]: { opacity: 0.5 } })
      expect(byKey).toEqual(byHand)
    }
    const { className, css } = await renderButton({ ...at(state('pressed'), { opacity: 0.7 }) })
    expect(css).toContain(`.${className}:active{opacity:0.7;}`)
  })
})
