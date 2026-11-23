import { afterEach, vi } from 'vitest'
import {
  warnAboutDroppedKey,
  warnAboutIgnoredOptions,
  warnAboutQuery,
  warnAboutUnheldState,
  warnAboutValues,
} from './warnStyle'

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

  it('warns about a unit in any case, with white space around, a sign and a missing digit', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnAboutValues({ a: ' 12PX ', b: '-.5em', c: '3.rem', d: '+1px', e: '4Q' })
    expect(warn).toHaveBeenCalledTimes(4)
    expect(warn.mock.calls.map(([text]) => String(text).split('"')[1])).toEqual([
      'a:  12PX ',
      'b: -.5em',
      'c: 3.rem',
      'e: 4Q',
    ])
  })

  it('does not warn about a unit it does not know, a space between number and unit, or a percentage', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnAboutValues({ a: '12foo', b: '12 px', c: 'px', d: '1.2.3px', e: '12%' })
    expect(warn).not.toHaveBeenCalled()
  })

  it('reads a long run of digits in linear time', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const digits = '1'.repeat(200_000)
    const start = performance.now()
    warnAboutValues({
      a: `${digits}!`,
      b: `${digits}${digits}px!`,
      c: `${'1 '.repeat(100_000)}!`,
      d: `1${' '.repeat(200_000)}!`,
    })
    expect(performance.now() - start).toBeLessThan(2000)
    expect(warn).not.toHaveBeenCalled()
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
    expect(warnAboutDroppedKey('&:focus', 'Gone')).toBeUndefined()
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('the values that have no equivalent', () => {
  it('warns about em, the viewport units, calc() and currentColor, in any case', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnAboutValues({
      margin: '1.5em',
      height: '100vh',
      minHeight: '100dvh',
      width: '50VW',
      maxWidth: '10svmin',
      left: 'calc(100% - 8px)',
      borderColor: 'currentColor',
      shadowColor: 'CURRENTCOLOR',
    })
    expect(warn.mock.calls.map(([text]) => text)).toEqual([
      '@umber-style/react-native: "margin: 1.5em" is in em, which has no equivalent on React Native (a style does not know the font size around it); it is passed as it is. Write a number, or a length in rem.',
      '@umber-style/react-native: "height: 100vh" is in a viewport unit, which has no equivalent in a React Native style; it is passed as it is. Write a percentage, or a number computed from the window size.',
      '@umber-style/react-native: "minHeight: 100dvh" is in a viewport unit, which has no equivalent in a React Native style; it is passed as it is. Write a percentage, or a number computed from the window size.',
      '@umber-style/react-native: "width: 50VW" is in a viewport unit, which has no equivalent in a React Native style; it is passed as it is. Write a percentage, or a number computed from the window size.',
      '@umber-style/react-native: "maxWidth: 10svmin" is in a viewport unit, which has no equivalent in a React Native style; it is passed as it is. Write a percentage, or a number computed from the window size.',
      '@umber-style/react-native: "left: calc(100% - 8px)" is a calc() expression, which React Native does not compute; it is passed as it is. Use add, subtract, multiply and divide, which return numbers.',
      '@umber-style/react-native: "borderColor: currentColor" uses currentColor, which React Native does not have; it is passed as it is. Give the colour itself.',
      '@umber-style/react-native: "shadowColor: CURRENTCOLOR" uses currentColor, which React Native does not have; it is passed as it is. Give the colour itself.',
    ])
  })

  it('puts the name of the component in front when it is known, once for each name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnAboutValues({ width: '3em' }, 'Card')
    warnAboutValues({ width: '3em' }, 'Card')
    warnAboutValues({ width: '3em' }, 'Panel')
    expect(warn.mock.calls.map(([text]) => String(text).split(' "')[0])).toEqual([
      '@umber-style/react-native: Card:',
      '@umber-style/react-native: Panel:',
    ])
  })
})

describe('warnAboutDroppedKey', () => {
  it('names the key, the component and the reason, once for each message', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const key of [
      '&:hover',
      ':focus',
      'a &',
      '@media (hover: hover)',
      '@media print',
      '@supports (display: grid)',
      '--accent',
      'animation',
      'transitionDuration',
      '&:hover',
    ]) {
      warnAboutDroppedKey(key, 'Button')
    }
    warnAboutDroppedKey('&:hover', undefined)
    const hint = 'A key for the web only goes in the web part of a shared style.'
    expect(warn.mock.calls.map(([text]) => text)).toEqual([
      `@umber-style/react-native: Button: "&:hover" is dropped: React Native has no selectors. ${hint}`,
      `@umber-style/react-native: Button: ":focus" is dropped: React Native has no selectors. ${hint}`,
      `@umber-style/react-native: Button: "a &" is dropped: React Native has no selectors. ${hint}`,
      `@umber-style/react-native: Button: "@media (hover: hover)" is dropped: React Native does not evaluate the media feature "hover". ${hint}`,
      `@umber-style/react-native: Button: "@media print" is dropped: React Native does not evaluate the media type "print". ${hint}`,
      `@umber-style/react-native: Button: "@supports (display: grid)" is dropped: React Native has no at-rules. ${hint}`,
      `@umber-style/react-native: Button: "--accent" is dropped: React Native has no custom properties. ${hint}`,
      `@umber-style/react-native: Button: "animation" is dropped: animations do not run on React Native yet. ${hint}`,
      `@umber-style/react-native: Button: "transitionDuration" is dropped: animations do not run on React Native yet. ${hint}`,
      `@umber-style/react-native: "&:hover" is dropped: React Native has no selectors. ${hint}`,
    ])
  })

  it('says nothing about the label, a condition key or a media query it evaluates, and nothing in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnAboutDroppedKey('label', 'Quiet')
    warnAboutDroppedKey('@media (min-width: 40em)', 'Quiet')
    warnAboutDroppedKey('@theme n0', 'Quiet')
    warnAboutDroppedKey('@scheme dark', 'Quiet')
    process.env.NODE_ENV = 'production'
    warnAboutDroppedKey('&:active', 'Quiet')
    warnAboutQuery('(hover: hover)', 'the media feature "hover"')
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('warnAboutIgnoredOptions', () => {
  it('names the web options given, once, and nothing for the options React Native reads or in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnAboutIgnoredOptions({ theme: {}, remBase: 10, lengthKeys: [], prefix: undefined })
    expect(warn).not.toHaveBeenCalled()
    warnAboutIgnoredOptions({ prefix: 'app', hasValueRepair: true, remBase: 10 })
    warnAboutIgnoredOptions({ prefix: 'app', hasValueRepair: true })
    expect(warn.mock.calls).toEqual([
      [
        '@umber-style/react-native: the options prefix, hasValueRepair are for the web, and React Native does not use them: they are ignored. Only theme, remBase and lengthKeys are read.',
      ],
    ])
    process.env.NODE_ENV = 'production'
    warnAboutIgnoredOptions({ suffix: '-x' })
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describe('warnAboutUnheldState', () => {
  it('warns once for each component and state, and not in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnAboutUnheldState('hovered', 'HoverCard')
    warnAboutUnheldState('hovered', 'HoverCard')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('follow onHoverIn and onHoverOut')
    process.env.NODE_ENV = 'production'
    warnAboutUnheldState('focused', 'HoverCard')
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
