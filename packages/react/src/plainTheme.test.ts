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

  it('keeps an object that two members share, which is not a cycle', () => {
    const shared = { size: 4 }
    const theme = { first: shared, second: shared }
    expect(toPlainTheme(theme)).toEqual({ theme, dropped: [] })
  })
})
