import { at } from './at'
import { compileRules } from './serialize'

describe('at', () => {
  it('is an object with the key and the style', () => {
    const style = { color: 'red' }
    const bp = '40em'
    expect(at(`@media (width >= ${bp})`, style)).toEqual({ '@media (width >= 40em)': style })
    expect(at('&:hover', null)).toEqual({ '&:hover': null })
  })

  it('spreads into a style that the serializer compiles', () => {
    const bp = '40em'
    expect(
      compileRules('.a', {
        gap: 8,
        ...at(`@media (width >= ${bp})`, { gap: 16 }),
        ...at(':hover', { gap: 4 }),
      })
    ).toEqual(['.a{gap:8px;}', '@media (width >= 40em){.a{gap:16px;}}', '.a:hover{gap:4px;}'])
  })
})
