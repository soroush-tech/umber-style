import { afterEach, vi } from 'vitest'
import { warnAboutValues } from './warnStyle'

const NODE_ENV = process.env.NODE_ENV

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  process.env.NODE_ENV = NODE_ENV
})

describe('warnAboutValues', () => {
  it('warns about a shorthand with several values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnAboutValues({ padding: '10px 20px', margin: '0 auto' })
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn.mock.calls[0][0]).toContain('"padding: 10px 20px" is a shorthand')
    expect(warn.mock.calls[1][0]).toContain('"margin: 0 auto" is a shorthand')
  })

  it('warns about a CSS unit', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnAboutValues({ width: '12px', height: '2.5rem' })
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn.mock.calls[0][0]).toContain('"width: 12px" has a CSS unit')
  })

  it('warns once for each distinct message', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnAboutValues({ top: '3px' })
    warnAboutValues({ top: '3px' })
    warnAboutValues({ top: '4px' })
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('accepts what the platform takes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnAboutValues({
      padding: 8,
      width: '50%',
      height: 'auto',
      color: '#fff',
      fontFamily: 'Helvetica Neue',
      boxShadow: '0 0 4px red',
      transform: [{ rotate: '45deg' }],
      lineHeight: '1.5',
    })
    expect(warn).not.toHaveBeenCalled()
  })

  it('does not warn in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env.NODE_ENV = 'production'
    warnAboutValues({ left: '7px', right: '1 2' })
    expect(warn).not.toHaveBeenCalled()
  })

  it('does not throw, and does not warn, where there is no process', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('process', undefined)
    expect(() => warnAboutValues({ bottom: '9px' })).not.toThrow()
    expect(warn).not.toHaveBeenCalled()
  })
})
