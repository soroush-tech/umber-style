import { alpha } from './alpha'
import { multiply } from './calc'
import { createKeyframesRule, findAnimationNames, isKeyframesName, keyframes } from './keyframes'

interface StandInTheme {
  palette: { muted: string; other: string }
  space: number[]
  deep: { a: { b: string } }
}

const NO_THEME = () => {
  throw new Error('no theme')
}

/** The rule of `name`, with `theme` for steps that are a function of it. */
const ruleOf = (name: string, theme: unknown = undefined, hasColorFallbacks = true) =>
  createKeyframesRule(name, () => theme, hasColorFallbacks)

describe('keyframes', () => {
  it('returns <label>-<hash> at once, and the same name for the same steps', () => {
    const name = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
    expect(name).toMatch(/^keyframes-[0-9a-z]+$/)
    expect(keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })).toBe(name)
    expect(keyframes({ from: { opacity: 0 }, to: { opacity: 0.5 } })).not.toBe(name)
    expect(isKeyframesName(name)).toBe(true)
    expect(isKeyframesName('keyframes-unknown')).toBe(false)
  })

  it('takes a label for the first part, and hashes the steps alone', () => {
    const steps = { to: { transform: 'rotate(360deg)' } }
    const plain = keyframes(steps)
    const spin = keyframes(steps, { label: 'spin' })
    expect(spin).toBe(`spin-${plain.slice('keyframes-'.length)}`)
    expect(keyframes(steps, { label: 'Fade_in-2' })).toMatch(/^Fade_in-2-/)
  })

  it('names the steps after normalising them: from and to, a comma list and an order are the same steps', () => {
    const name = keyframes({ from: { opacity: 1 }, '50%': { opacity: 0.4 }, to: { opacity: 1 } })
    expect(keyframes({ '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } })).toBe(name)
    expect(
      keyframes({ '100%': { opacity: 1 }, '50%': { opacity: 0.4 }, '0%': { opacity: 1 } })
    ).toBe(name)
  })

  it('names steps that are a function of the theme by the tokens they read, not by their values', () => {
    const muted = keyframes((theme: StandInTheme) => ({ from: { color: theme.palette.muted } }))
    expect(keyframes((theme: StandInTheme) => ({ from: { color: theme.palette.muted } }))).toBe(
      muted
    )
    expect(keyframes((theme: StandInTheme) => ({ from: { color: theme.palette.other } }))).not.toBe(
      muted
    )
    // The text of a path is not mistaken for the token.
    expect(keyframes({ from: { color: 'palette.muted' } })).not.toBe(muted)
  })

  it('gives a function a stand-in whose every read, at any depth and by array index, is its path as text', () => {
    const seen: string[] = []
    keyframes((theme: StandInTheme) => {
      seen.push(String(theme.deep.a.b), `${theme.space[2]}px`, String(theme))
      return { to: { opacity: 0.11 } }
    })
    expect(seen).toEqual(['deep.a.b', 'space.2px', ''])
    const stand = keyframes((theme: StandInTheme) => ({
      to: { margin: theme.space[1], color: [theme.palette.muted, 'red'] },
    }))
    expect(ruleOf(stand, { space: [0, 'var(--s-1)'], palette: { muted: 'var(--p-m)' } })).toBe(
      `@keyframes ${stand}{100%{margin:var(--s-1);color:var(--p-m);color:red;}}`
    )
  })

  it('reads nothing of a symbol of the stand-in', () => {
    let iterator: unknown = 'unread'
    keyframes((theme: StandInTheme) => {
      iterator = (theme.palette as unknown as Record<symbol, unknown>)[Symbol.iterator]
      return { to: { opacity: 0.12 } }
    })
    expect(iterator).toBeUndefined()
  })

  it('throws a TypeError that names a nested style in a step: a selector or an at-rule', () => {
    expect(() => keyframes({ from: { opacity: 0, '&:hover': { opacity: 1 } } as never })).toThrow(
      new TypeError(
        'keyframes(): the step "from" holds "&:hover", a nested style (a selector or an at-rule). A step is flat: it holds declarations only.'
      )
    )
    expect(() =>
      keyframes({ '50%': { '@media (min-width: 1px)': { opacity: 1 } } as never })
    ).toThrow(/the step "50%" holds "@media \(min-width: 1px\)"/)
  })

  it('throws a TypeError for a key that is not a step, and for steps that are not objects', () => {
    for (const key of ['hover', '50', '101%', '-5%', 'from, middle', 'entry 10%']) {
      expect(() => keyframes({ [key]: { opacity: 0 } })).toThrow(
        new TypeError(
          `keyframes(): "${key}" is not a step: use from, to, a percentage from 0% to 100%, or a comma list of them.`
        )
      )
    }
    expect(() => keyframes({ from: 'opacity: 0' as never })).toThrow(
      new TypeError('keyframes(): the step "from" must be an object of declarations.')
    )
    expect(() => keyframes({ from: null as never })).toThrow(/the step "from" must be an object/)
    expect(() => keyframes(null as never)).toThrow(
      new TypeError('keyframes(): the steps must be an object, or a function that returns one.')
    )
    expect(() => keyframes((() => 'x') as never)).toThrow(/the steps must be an object/)
  })

  it('throws a TypeError for a label that is not an identifier', () => {
    for (const label of ['', 'two words', '1st', '-x', 'a.b']) {
      expect(() => keyframes({ to: { opacity: 1 } }, { label })).toThrow(
        new TypeError(
          `keyframes(): the label "${label}" is not an identifier: use letters, digits, '-' and '_', not starting with a digit or '-'.`
        )
      )
    }
  })

  it('names steps that compute with a token, by the token: the helpers take the stand-in as its path', () => {
    const double = keyframes((theme: StandInTheme) => ({
      from: { margin: multiply(theme.space[1], 2) },
    }))
    const triple = keyframes((theme: StandInTheme) => ({
      from: { margin: multiply(theme.space[1], 3) },
    }))
    const other = keyframes((theme: StandInTheme) => ({
      from: { margin: multiply(theme.space[2], 2) },
    }))
    expect(new Set([double, triple, other]).size).toBe(3)
    const faded = keyframes((theme: StandInTheme) => ({
      from: { color: alpha(theme.palette.muted, 0.5) },
    }))
    expect(
      ruleOf(faded, { palette: { muted: 'var(--u-m)' } }).startsWith(
        `@keyframes ${faded}{0%{color:var(--u-m);color:color-mix(in srgb, var(--u-m) 50%`
      )
    ).toBe(true)
  })
})

describe('createKeyframesRule', () => {
  it('sorts the steps, expands comma lists, and writes from and to as 0% and 100%', () => {
    const name = keyframes({
      to: { opacity: 1 },
      '25%, 75%': { opacity: 0.5 },
      from: { opacity: 0 },
    })
    expect(ruleOf(name)).toBe(
      `@keyframes ${name}{0%{opacity:0;}25%{opacity:0.5;}75%{opacity:0.5;}100%{opacity:1;}}`
    )
  })

  it('merges the steps of one offset, the later one winning, and keeps fractions', () => {
    const name = keyframes({
      '0%, 100%': { opacity: 1, color: 'red' },
      to: { opacity: 0 },
      '33.5%': { top: 0 },
      '.5%': { top: 1 },
    })
    expect(ruleOf(name)).toBe(
      `@keyframes ${name}{0%{opacity:1;color:red;}0.5%{top:1px;}33.5%{top:0;}100%{color:red;opacity:0;}}`
    )
  })

  it('writes declarations as a class does: kebab-case, units, times, fallback lists, alpha() with or without its fallback', () => {
    const name = keyframes({
      from: {
        backgroundColor: alpha('#ff0000', 0.5),
        marginTop: 4,
        animationDelay: 0,
        width: ['100%', 'stretch'],
        '--x': 2,
        color: undefined,
      },
    })
    expect(ruleOf(name)).toBe(
      `@keyframes ${name}{0%{background-color:rgba(255, 0, 0, 0.5);background-color:color-mix(in srgb, #ff0000 50%, transparent);margin-top:4px;animation-delay:0ms;width:100%;width:stretch;--x:2;}}`
    )
    expect(ruleOf(name, undefined, false)).toContain(
      '0%{background-color:color-mix(in srgb, #ff0000 50%, transparent);margin-top'
    )
  })

  it('leaves out a step that declares nothing', () => {
    const name = keyframes({ from: {}, to: { opacity: 1 } })
    expect(ruleOf(name)).toBe(`@keyframes ${name}{100%{opacity:1;}}`)
  })

  it('reads the theme only for steps that are a function of it, and only then', () => {
    const plain = keyframes({ to: { opacity: 0.25 } })
    expect(createKeyframesRule(plain, NO_THEME, true)).toBe(
      `@keyframes ${plain}{100%{opacity:0.25;}}`
    )
    const themed = keyframes((theme: StandInTheme) => ({ to: { color: theme.palette.muted } }))
    expect(() => createKeyframesRule(themed, NO_THEME, true)).toThrow('no theme')
    expect(ruleOf(themed, { palette: { muted: 'var(--u-palette-muted)' } })).toBe(
      `@keyframes ${themed}{100%{color:var(--u-palette-muted);}}`
    )
  })
})

describe('findAnimationNames', () => {
  const spin = keyframes({ to: { transform: 'rotate(360deg)' } }, { label: 'spin' })
  const fade = keyframes({ from: { opacity: 0 } }, { label: 'fade' })

  it('finds a name in the shorthand, past the commas of cubic-bezier() and a delay', () => {
    expect(
      findAnimationNames([
        `.a{animation:${spin} 1s cubic-bezier(0.1, 0.7, 1, 0.1) 200ms infinite;}`,
      ])
    ).toEqual([spin])
  })

  it('finds each name of a list, in the shorthand and in animation-name, once', () => {
    expect(findAnimationNames([`.a{animation:${spin} 1s,${fade} 2s ease-in;}`])).toEqual([
      spin,
      fade,
    ])
    expect(
      findAnimationNames([
        `.a{color:red;animation-name:${fade}, ${spin};}`,
        `.a:hover{animation-name:${fade};}`,
      ])
    ).toEqual([fade, spin])
  })

  it('finds names in nested selectors and at-rules', () => {
    expect(
      findAnimationNames([
        '.a{color:red;}',
        `.a:hover{animation:${spin} 1s;}`,
        `@media (min-width: 600px){.a{animation-name:${fade};}}`,
      ])
    ).toEqual([spin, fade])
  })

  it('matches whole identifiers only', () => {
    expect(
      findAnimationNames([
        `.a{animation:${spin}ner 1s,x${spin} 1s,${spin}-2 1s;animation-name:${fade}_b;}`,
      ])
    ).toEqual([])
  })

  it('looks at animation and animation-name only, and passes other names through', () => {
    expect(
      findAnimationNames([
        `.a{--animation:${spin};-webkit-animation:${spin} 1s;animation-duration:1s;content:"${fade}";}`,
        `.a{transition:animation 1s;will-change:animation;animation:app-own 1s;}`,
      ])
    ).toEqual([])
  })
})
