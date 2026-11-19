import { scanVariables } from './variables'

describe('scanVariables', () => {
  it('finds the variables with the start, in order', () => {
    expect(scanVariables('color:var(--u-a);margin:var(--u-b-1) var(--u-c_2);', '--u-')).toEqual([
      '--u-a',
      '--u-b-1',
      '--u-c_2',
    ])
  })

  it('finds a variable that has a fallback, and the variables inside the fallback', () => {
    expect(scanVariables('x:var(--u-a, 8px);y:var(--u-b,var(--u-c,var(--other)))', '--u-')).toEqual(
      ['--u-a', '--u-b', '--u-c']
    )
  })

  it('skips variables with another start, and var( that is not followed by a name', () => {
    expect(scanVariables('x:var(--other) var(  --u-a ) var(y) var( ) var(', '--u-')).toEqual([
      '--u-a',
    ])
    expect(scanVariables('x:var(--other, var(--u-b))', '--u-')).toEqual(['--u-b'])
  })

  it('finds a name at the end of the text, and nothing in text without var(', () => {
    expect(scanVariables('var(--u-end', '--u-')).toEqual(['--u-end'])
    expect(scanVariables('color:red;', '--u-')).toEqual([])
    expect(scanVariables('', '--u-')).toEqual([])
  })

  it('takes uppercase and other characters as the end of a name', () => {
    expect(scanVariables('var(--u-aB)', '--u-')).toEqual(['--u-a'])
  })

  it('is linear on a long text with many openings', () => {
    const text = 'var(--u-a'.repeat(20000)
    expect(scanVariables(text, '--u-')).toHaveLength(20000)
  })
})
