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
})
