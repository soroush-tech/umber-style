import { toNativeStyle } from './toNativeStyle'

describe('toNativeStyle', () => {
  it('drops the label, selectors and at-rules, whole', () => {
    expect(
      toNativeStyle({
        label: 'button-root',
        color: '#fff',
        padding: 8,
        '&:hover': { color: 'red', '&:focus': { color: 'blue' } },
        '@media (min-width: 40em)': { padding: 16 },
      })
    ).toEqual({ color: '#fff', padding: 8 })
  })

  it('drops custom properties and a selector without a nested object', () => {
    expect(
      toNativeStyle({ '--accent': '#1b5fd1', ':hover': 1, 'a &': 2, '@supports': 3, padding: 8 })
    ).toEqual({ padding: 8 })
  })

  it('drops the animation and transition properties, also in the native part, and keeps transform', () => {
    expect(
      toNativeStyle({
        animation: 'pulse-1x 1s infinite',
        animationName: 'pulse-1x',
        animationDuration: 300,
        transition: 'opacity 200ms',
        transitionProperty: 'opacity',
        transitionDelay: 100,
        transform: [{ scale: 2 }],
        opacity: 1,
        native: { animationTimingFunction: 'linear', transitionDuration: 5, elevation: 1 },
      })
    ).toEqual({ transform: [{ scale: 2 }], opacity: 1, elevation: 1 })
  })

  it('keeps the object-valued properties of the platform', () => {
    const style = {
      shadowOffset: { width: 0, height: 2 },
      textShadowOffset: { width: 1, height: 1 },
      transform: [{ rotate: '45deg' }, { translateX: 4 }],
    }
    expect(toNativeStyle(style)).toEqual(style)
  })

  it('keeps arrays, null, undefined and false', () => {
    const style = { fontFamily: ['a', 'b'], a: null, b: undefined, c: false }
    expect(toNativeStyle(style)).toEqual(style)
  })
})

describe('the platform parts of a style written for both platforms', () => {
  it('merges the native part over the rest and drops the web part', () => {
    expect(
      toNativeStyle({
        padding: 8,
        elevation: 1,
        web: { '&:hover': { opacity: 0.8 } },
        native: { elevation: 2, margin: 4 },
      })
    ).toEqual({ padding: 8, elevation: 2, margin: 4 })
  })

  it('drops a part that is not an object', () => {
    expect(toNativeStyle({ padding: 8, native: undefined, web: false })).toEqual({ padding: 8 })
    expect(toNativeStyle({ padding: 8, native: {} })).toEqual({ padding: 8 })
  })
})

describe('the values with CSS units', () => {
  it('turns lengths in px, rem and numeric strings into numbers, in the native part and a matching condition too', () => {
    const condition = { theme: undefined, colorScheme: 'dark' as const }
    expect(
      toNativeStyle(
        {
          padding: '8px',
          margin: '0',
          fontSize: '1rem',
          opacity: '0.5',
          width: '50%',
          height: 'auto',
          fontWeight: '700',
          color: '#fff',
          native: { borderWidth: '1px' },
          '@scheme dark': { borderRadius: '0.25rem' },
        },
        condition
      )
    ).toEqual({
      padding: 8,
      margin: 0,
      fontSize: 16,
      opacity: 0.5,
      width: '50%',
      height: 'auto',
      fontWeight: '700',
      color: '#fff',
      borderWidth: 1,
      borderRadius: 4,
    })
  })

  it('takes the base of rem from the settings, and warns about what has no equivalent, passing it as it is', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      toNativeStyle({ padding: '2rem', margin: '2em', height: '100vh' }, undefined, {
        remBase: 10,
        name: 'Units',
      })
    ).toEqual({ padding: 20, margin: '2em', height: '100vh' })
    expect(warn.mock.calls.map(([text]) => String(text).split('" ')[0])).toEqual([
      '@umber-style/react-native: Units: "margin: 2em',
      '@umber-style/react-native: Units: "height: 100vh',
    ])
    warn.mockRestore()
  })
})

describe('the warning about a dropped key', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('names each web-only key written outside the web part, with the component, once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const style = {
      padding: 8,
      '&:hover': { opacity: 0.8 },
      native: { '@media (min-width: 40em)': { padding: 16 } },
      '@scheme dark': { '--accent': 'red', transition: 'opacity 200ms' },
    }
    const condition = { theme: undefined, colorScheme: 'dark' as const }
    toNativeStyle(style, condition, { remBase: 16, name: 'Dropping' })
    toNativeStyle(style, condition, { remBase: 16, name: 'Dropping' })
    expect(warn.mock.calls.map(([text]) => String(text).split(' is dropped')[0])).toEqual([
      '@umber-style/react-native: Dropping: "&:hover"',
      '@umber-style/react-native: Dropping: "@media (min-width: 40em)"',
      '@umber-style/react-native: Dropping: "--accent"',
      '@umber-style/react-native: Dropping: "transition"',
    ])
  })

  it('says nothing about the label, the web part, or a condition that does not match', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      toNativeStyle(
        {
          label: 'quiet',
          padding: 8,
          web: { '&:hover': { opacity: 0.8 }, animation: 'pulse 1s', '--x': 1 },
          '@scheme dark': { padding: 4 },
          '@theme n999': { padding: 2 },
        },
        undefined,
        { remBase: 16, name: 'Quiet' }
      )
    ).toEqual({ padding: 8 })
    expect(warn).not.toHaveBeenCalled()
  })

  it('says nothing in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const environment = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      toNativeStyle({ '&:pressed': { opacity: 1 }, margin: '1em' }, undefined, {
        remBase: 16,
        name: 'Production',
      })
    } finally {
      process.env.NODE_ENV = environment
    }
    expect(warn).not.toHaveBeenCalled()
  })
})
