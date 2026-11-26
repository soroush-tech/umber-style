import * as internal from './internal'

describe('the internal entry', () => {
  it('holds the development helpers of the bindings and nothing else', () => {
    expect(Object.keys(internal).sort()).toEqual(['callCheckedStyle', 'createThemeGuard'])
  })
})
