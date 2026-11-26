import { toPlainTheme } from './plainTheme'

describe('toPlainTheme', () => {
  it('gives a plain theme back as it is, with nothing left out', () => {
    const theme = { palette: { primary: '#000' }, space: [0, 4], flags: { isOn: true, none: null } }
    expect(toPlainTheme(theme)).toEqual({ theme, dropped: [] })
    expect(toPlainTheme(theme).theme).toBe(theme)
  })

  it('leaves out a function, a symbol and an instance, keeps the place of an item, and lists the paths', () => {
    const theme = {
      palette: { primary: '#000', pick: () => '#fff' },
      list: [1, Symbol('x')],
      when: new Date(0),
    }
    const { theme: plain, dropped } = toPlainTheme(theme)
    expect(plain).toEqual({ palette: { primary: '#000' }, list: [1, undefined] })
    expect(dropped).toEqual(['palette.pick', 'list.1', 'when'])
  })

  it(
    'leaves out a member that refers back to an object it is inside of, and returns',
    { timeout: 1000 },
    () => {
      type Node = { name: string; self?: Node; items?: Node[]; nested?: { parent?: Node } }
      const theme: Node = { name: 'root' }
      theme.self = theme
      theme.items = [theme]
      theme.nested = { parent: theme }
      const { theme: plain, dropped } = toPlainTheme(theme)
      expect(plain).toEqual({ name: 'root', items: [undefined], nested: {} })
      expect(dropped).toEqual(['self', 'items.0', 'nested.parent'])
    }
  )

  it('copies an object with members that are not enumerable or have a symbol key, with its enumerable members, and lists none of them', () => {
    const breakpoints = { sm: '600px', md: '840px' }
    Object.defineProperty(breakpoints, 'up', {
      value: (key: 'sm' | 'md') => `@media (min-width:${breakpoints[key]})`,
      enumerable: false,
    })
    Object.defineProperty(breakpoints, 'width', { get: () => 1, enumerable: false })
    const palette = { primary: '#000', [Symbol('brand')]: 'mark' }
    const theme = { palette, breakpoints, space: [0, 4] }
    Object.defineProperty(theme, 'mixins', { value: { toolbar: () => ({}) }, enumerable: false })
    const { theme: plain, dropped } = toPlainTheme(theme)
    expect(dropped).toEqual([])
    expect(plain).not.toBe(theme)
    expect(plain).toEqual({
      palette: { primary: '#000' },
      breakpoints: { sm: '600px', md: '840px' },
      space: [0, 4],
    })
    const { palette: plainPalette, breakpoints: plainBreakpoints, space } = plain as typeof theme
    expect(Reflect.ownKeys(plain)).toEqual(['palette', 'breakpoints', 'space'])
    expect(Reflect.ownKeys(plainBreakpoints)).toEqual(['sm', 'md'])
    expect(Reflect.ownKeys(plainPalette)).toEqual(['primary'])
    // A member with nothing hidden is the same object.
    expect(space).toBe(theme.space)
  })

  it('still lists a function under an enumerable key, next to members that are not enumerable', () => {
    const breakpoints = { md: '840px', down: () => '' }
    Object.defineProperty(breakpoints, 'up', { value: () => '', enumerable: false })
    const { theme: plain, dropped } = toPlainTheme({ breakpoints })
    expect(dropped).toEqual(['breakpoints.down'])
    expect(plain).toEqual({ breakpoints: { md: '840px' } })
    expect(Reflect.ownKeys((plain as { breakpoints: object }).breakpoints)).toEqual(['md'])
  })

  it('keeps an object that two members share, which is not a cycle', () => {
    const shared = { size: 4 }
    const theme = { first: shared, second: shared }
    expect(toPlainTheme(theme)).toEqual({ theme, dropped: [] })
  })
})
