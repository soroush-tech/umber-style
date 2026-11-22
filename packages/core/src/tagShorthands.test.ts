import { withTagShorthands } from './tagShorthands'

describe('withTagShorthands', () => {
  const styled = withTagShorthands(Object.assign((tag: string) => `made ${tag}`, { own: 1 }))
  const members = styled as unknown as Record<string | symbol, unknown>

  it('makes the member of a tag name on access', () => {
    expect(members.div).toBe('made div')
    expect(members.foreignObject).toBe('made foreignObject')
    expect(members.h1).toBe('made h1')
  })

  it('keeps the members of the function, and makes nothing for other keys or then', () => {
    expect(styled.own).toBe(1)
    expect(styled.length).toBe(1)
    expect(members.then).toBeUndefined()
    expect(members.Div).toBeUndefined()
    expect(members['data-x']).toBeUndefined()
    expect(members[Symbol.iterator]).toBeUndefined()
    expect(styled('span')).toBe('made span')
  })

  it('has every tag as an own enumerable member, so Object.assign copies them, each made when read', () => {
    const made: string[] = []
    const counted = withTagShorthands((tag: string) => {
      made.push(tag)
      return `made ${tag}`
    })
    expect(made).toEqual([])
    expect(Object.keys(counted)).toEqual(
      expect.arrayContaining(['div', 'h1', 'svg', 'foreignObject'])
    )
    const copy = Object.assign(() => 'own', counted) as unknown as Record<string, unknown>
    expect(copy.div).toBe('made div')
    expect(copy.textPath).toBe('made textPath')
    expect(made).toHaveLength(Object.keys(counted).length)
    // A tag that is not in the list is made on access, as before.
    expect((counted as unknown as Record<string, unknown>).selectedcontent).toBe(
      'made selectedcontent'
    )
  })
})
