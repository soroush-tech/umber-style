import { createEngine } from './createEngine'

let count = 0
const nextPrefix = () => `nt${++count}`

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

const base = { palette: { primary: '#0000ff' }, space: [0, 4, 8] }
const second = { palette: { primary: '#008000' } }
const third = { palette: { primary: '#ff0000' }, space: [0, 10, 20] }

describe('nested themes in a real browser', () => {
  it('three levels each resolve their own token values', () => {
    const engine = createEngine(base, { prefix: nextPrefix() })
    const use = engine.cache.css({
      color: engine.refs.palette.primary,
      paddingLeft: engine.refs.space[1],
    })
    const scope = engine.scopeClass()
    const first = document.createElement('div')
    first.className = `${engine.themeClass(base)} ${scope}`
    const middle = document.createElement('div')
    middle.className = `${engine.themeClass(second)} ${scope}`
    const last = document.createElement('div')
    last.className = `${engine.themeClass(third)} ${scope}`
    const leaves = [first, middle, last].map(() => {
      const element = document.createElement('span')
      element.className = use
      return element
    })
    first.append(leaves[0], middle)
    middle.append(leaves[1], last)
    last.append(leaves[2])
    document.body.append(first)

    const read = (element: Element) => {
      const computed = getComputedStyle(element)
      return [computed.color, computed.paddingLeft]
    }
    expect(read(leaves[0])).toEqual(['rgb(0, 0, 255)', '4px'])
    // The second theme gives no space: the first one's value comes through the cascade.
    expect(read(leaves[1])).toEqual(['rgb(0, 128, 0)', '4px'])
    expect(read(leaves[2])).toEqual(['rgb(255, 0, 0)', '10px'])
  })

  it('display: contents wrappers do not change the layout of the children of a flex parent', () => {
    const engine = createEngine(base, { prefix: nextPrefix() })
    const row = engine.cache.css({ display: 'flex', gap: '10px', width: '400px' })
    const item = engine.cache.css({ width: '50px', height: '20px', backgroundColor: 'red' })
    const scope = engine.scopeClass()

    const direct = document.createElement('div')
    direct.className = row
    const wrapped = document.createElement('div')
    wrapped.className = row
    for (let index = 0; index < 3; index++) {
      const a = document.createElement('div')
      a.className = item
      direct.appendChild(a)
      const wrapper = document.createElement('div')
      wrapper.className = `${engine.themeClass(base)} ${scope}`
      const b = document.createElement('div')
      b.className = item
      wrapper.appendChild(b)
      wrapped.appendChild(wrapper)
    }
    document.body.append(direct, wrapped)

    expect(getComputedStyle(wrapped.firstElementChild!).display).toBe('contents')
    const boxes = (parent: Element) =>
      [...parent.querySelectorAll(`.${item}`)].map((element) => {
        const rect = element.getBoundingClientRect()
        return [rect.left - parent.getBoundingClientRect().left, rect.width, rect.height]
      })
    expect(boxes(wrapped)).toEqual(boxes(direct))
    expect(boxes(direct)).toEqual([
      [0, 50, 20],
      [60, 50, 20],
      [120, 50, 20],
    ])
  })
})
