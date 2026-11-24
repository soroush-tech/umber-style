import { act, render } from '@testing-library/react'
import { createElement, useState } from 'react'
import { Pressable } from 'react-native'
import * as library from 'react-native-reanimated'
import { at, keyframes, state } from '@umber-style/core'
import { platform } from '../vitest.react-native'
import { animated } from './animated'
import { createStyle } from './createStyle'
import { createDefaultStyle } from './defaultStyle'
import { toNativeStyle } from './toNativeStyle'

// The library's official mock (`react-native-reanimated/mock`, see vitest.config.ts), with a spy on the one
// function whose calls the tests count. The mock's `createAnimatedComponent` returns the component itself.
vi.mock('react-native-reanimated', async (importOriginal) => {
  const mock = await importOriginal<typeof library>()
  return { ...mock, createAnimatedComponent: vi.fn(mock.createAnimatedComponent) }
})

const { css, cubicBezier, steps } = library
const createAnimatedComponent = vi.mocked(library.createAnimatedComponent)

const theme = { palette: { muted: '#cccccc' }, space: ['0px', '4px', '8px'] }
const pulse = keyframes({ '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } }, { label: 'pulse' })
/** What the warning about an animation key says without the entry. */
const MOTION_OFF =
  "the animated entry is not on, so animations and transitions do not run. With react-native-reanimated installed, import { animated } from '@umber-style/react-native/animated' and pass it: createStyle(theme, { animated }) or configure({ animated })."
const PULSE_STEPS = { '0%': { opacity: 1 }, '100%': { opacity: 1 }, '50%': { opacity: 0.4 } }

type Props = Record<string, unknown>

/** A stand-in for a native component: it records the props it gets. */
function createStandIn(name = 'View') {
  const calls: Props[] = []
  const View = (props: Props) => {
    calls.push(props)
    return createElement('view')
  }
  Object.defineProperty(View, 'name', { value: name })
  return { View, calls }
}

/** `style` turned into a native style as a styled component named `Pulse` turns it, with the entry. */
function translate(
  style: Record<string, unknown>,
  motion = animated.bind({ remBase: 16, readTheme: () => theme })
) {
  return toNativeStyle(style, undefined, { remBase: 16, name: 'Pulse', motion }) as Props
}

/** The development warnings given so far, without the prefix of the binding. */
function readWarnings(warn: { mock: { calls: unknown[][] } }): string[] {
  return warn.mock.calls.map(([message]) =>
    String(message).replace('@umber-style/react-native: ', '')
  )
}

let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  platform.setReducedMotion(false)
  platform.forgetPressables()
  createAnimatedComponent.mockClear()
  vi.restoreAllMocks()
})

describe('the translation, one row at a time', () => {
  it('turns a name of keyframes into the rule of the library, the same object for one name', () => {
    const motion = animated.bind({ remBase: 16, readTheme: () => theme })
    const first = translate({ animationName: pulse }, motion)
      .animationName as library.CSSKeyframesRule
    const second = translate({ animation: `${pulse} 1s` }, motion).animationName
    expect(first).toBeInstanceOf(css.keyframes({ to: { opacity: 1 } }).constructor)
    expect(first.cssRules).toEqual(PULSE_STEPS)
    expect(second).toBe(first)
    expect(translate({ animationName: 'none' })).toEqual({ animationName: 'none' })
  })

  it('reads a list of names, leaves none out, and warns about a name that keyframes did not return', () => {
    const fade = keyframes({ from: { opacity: 0 } }, { label: 'fade' })
    const { animationName } = translate({ animationName: `${pulse}, none, ${fade}` })
    expect((animationName as library.CSSKeyframesRule[]).map((rule) => rule.cssRules)).toEqual([
      PULSE_STEPS,
      { '0%': { opacity: 0 } },
    ])
    expect(translate({ animationName: 'spin' })).toEqual({ animationName: 'none' })
    expect(readWarnings(warn)).toEqual([
      'Pulse: "animationName: spin" is not a name that keyframes returned, so no animation runs for it. Give the name keyframes returns.',
    ])
  })

  it('reads times in s and ms, in any case, and numbers as milliseconds', () => {
    expect(
      translate({
        animationDuration: '1.5s',
        animationDelay: '-300MS',
        transitionDuration: 200,
        transitionDelay: '.5s, 1e3ms',
      })
    ).toEqual({
      animationDuration: 1500,
      animationDelay: -300,
      transitionDuration: 200,
      transitionDelay: [500, 1000],
    })
  })

  it('passes the named easings, and parses cubic-bezier() and steps() text into the easings of the library', () => {
    expect(
      translate({
        animationTimingFunction: 'ease-in-out',
        transitionTimingFunction:
          'cubic-bezier(0.25, -0.5, 0.75, 1.5), steps(4, jump-start), steps(3)',
      })
    ).toEqual({
      animationTimingFunction: 'ease-in-out',
      transitionTimingFunction: [
        cubicBezier(0.25, -0.5, 0.75, 1.5),
        steps(4, 'jump-start'),
        steps(3, 'end'),
      ],
    })
    const easing = cubicBezier(0, 0, 1, 1)
    expect(translate({ animationTimingFunction: easing as never }).animationTimingFunction).toBe(
      easing
    )
  })

  it('drops an easing it cannot read, with a warning, so that the library takes its default, ease, as the web does', () => {
    for (const text of [
      'cubic-bezier(1.5, 0, 0, 1)',
      'cubic-bezier(0, 0, 1)',
      'steps(0)',
      'steps(1, jump-none)',
      'steps(2.5)',
      'steps(2, middle)',
      'steps(2, end, end)',
      'linear(0, 1)',
      'bounce',
    ]) {
      expect(translate({ opacity: 1, animationTimingFunction: text })).toEqual({ opacity: 1 })
    }
    expect(readWarnings(warn)[0]).toBe(
      'Pulse: "animationTimingFunction: cubic-bezier(1.5, 0, 0, 1)" is not valid: it is dropped, as the web drops it. Write a named easing, cubic-bezier(x1, y1, x2, y2) or steps(count, position).'
    )
    expect(warn).toHaveBeenCalledTimes(9)
  })

  it('reads the count, the direction, the fill mode, the play state and the behavior', () => {
    expect(
      translate({
        animationIterationCount: 'infinite, 2, 0.5',
        animationDirection: 'Alternate',
        animationFillMode: 'both',
        animationPlayState: 'paused',
        transitionBehavior: 'allow-discrete',
      })
    ).toEqual({
      animationIterationCount: ['infinite', 2, 0.5],
      animationDirection: 'alternate',
      animationFillMode: 'both',
      animationPlayState: 'paused',
      transitionBehavior: 'allow-discrete',
    })
  })

  it('drops a value the library would reject, with a warning, and keeps an earlier valid one', () => {
    expect(translate({ animation: `${pulse} 1s 3`, animationDuration: '-1s' })).toMatchObject({
      animationDuration: 1000,
      animationIterationCount: 3,
    })
    expect(
      translate({
        opacity: 1,
        animationDuration: '-1s',
        animationIterationCount: -1,
        animationDirection: 'sideways',
        animationFillMode: 1,
        animationPlayState: 'stopped',
        transitionDelay: 'soon',
        transitionBehavior: 'smooth',
        transitionProperty: 'none, opacity',
      } as never)
    ).toEqual({ opacity: 1 })
    expect(warn).toHaveBeenCalledTimes(8)
    expect(readWarnings(warn)).toContain(
      'Pulse: "animationDuration: -1s" is not valid: it is dropped, as the web drops it. Write a time of 0 or more, such as 1.5s or 300ms.'
    )
  })

  it('names the properties that transition as the platform names them', () => {
    expect(translate({ transitionProperty: 'background-color, opacity' })).toEqual({
      transitionProperty: ['backgroundColor', 'opacity'],
    })
    expect(translate({ transitionProperty: 'all' })).toEqual({ transitionProperty: 'all' })
  })

  it('drops the animation keys the library does not run, with a warning', () => {
    expect(translate({ opacity: 1, animationTimeline: 'scroll()' } as never)).toEqual({
      opacity: 1,
    })
    expect(readWarnings(warn)).toEqual([
      'Pulse: "animationTimeline" is not run by the animation library on React Native; it is dropped.',
    ])
  })
})

describe('values given as the library takes them', () => {
  it('reads a list item by item, passes a rule or an easing of the library, and drops an item of the wrong type', () => {
    const rule = css.keyframes({ to: { opacity: 0 } })
    expect(
      translate({
        animationDuration: [100, '1s'],
        animationName: [rule, pulse],
      } as never)
    ).toEqual({ animationDuration: [100, 1000], animationName: [rule, expect.anything()] })
    expect(
      translate({
        opacity: 1,
        animationName: [rule, 4],
        transitionProperty: [1],
        transitionTimingFunction: 2,
      } as never)
    ).toEqual({ opacity: 1 })
    expect(warn).toHaveBeenCalledTimes(3)
  })
})

describe('what a key and value set', () => {
  it('is read once for each text, component and key, and forgotten together after 1000', () => {
    const motion = animated.bind({ remBase: 16, readTheme: () => theme })
    for (let index = 0; index <= 1000; index++) {
      expect(translate({ transitionDuration: `${index}ms` }, motion)).toEqual({
        transitionDuration: index,
      })
    }
    expect(translate({ transitionDuration: '0ms', opacity: 1 }, motion)).toEqual({
      transitionDuration: 0,
      opacity: 1,
    })
  })
})

describe('reduce', () => {
  it('gives the same object for a style without animation keys, and for another style once made', () => {
    const motion = animated.bind({ remBase: 16, readTheme: () => theme })
    const still = { opacity: 1 }
    const moving = translate({ opacity: 1, transition: 'opacity 1s' }, motion)
    expect(motion.reduce(still)).toBe(still)
    expect(motion.reduce(moving)).toEqual({ opacity: 1 })
    expect(motion.reduce(moving)).toBe(motion.reduce(moving))
    expect(motion.reduce(7 as never)).toBe(7)
  })
})

describe('the shorthands', () => {
  it('expand animation as CSS does: every longhand, the parts not given at their initial values', () => {
    const style = translate({ animation: `${pulse} 1.5s ease-in-out infinite` })
    expect(style).toEqual({
      animationName: expect.anything(),
      animationDuration: 1500,
      animationTimingFunction: 'ease-in-out',
      animationDelay: 0,
      animationIterationCount: 'infinite',
      animationDirection: 'normal',
      animationFillMode: 'none',
      animationPlayState: 'running',
    })
    expect((style.animationName as library.CSSKeyframesRule).cssRules).toEqual(PULSE_STEPS)
  })

  it('read the first time as the duration and the second as the delay, and a keyword of a part already set as the name', () => {
    expect(translate({ animation: `2s 1s none ${pulse} paused reverse 3` })).toMatchObject({
      animationDuration: 2000,
      animationDelay: 1000,
      animationFillMode: 'none',
      animationPlayState: 'paused',
      animationDirection: 'reverse',
      animationIterationCount: 3,
    })
    expect(translate({ animation: '1s none none' })).toMatchObject({
      animationFillMode: 'none',
      animationName: 'none',
    })
  })

  it('give a list in each longhand for a list of animations', () => {
    const fade = keyframes({ from: { opacity: 0 } }, { label: 'fade' })
    expect(translate({ animation: `${pulse} 1s, ${fade} 2s steps(2) forwards` })).toMatchObject({
      animationDuration: [1000, 2000],
      animationTimingFunction: ['ease', steps(2, 'end')],
      animationFillMode: ['none', 'forwards'],
    })
  })

  it('let a later key win over an earlier one, as in a rule of the web', () => {
    expect(translate({ animationDuration: '5s', animation: `${pulse} 1s` }).animationDuration).toBe(
      1000
    )
    expect(translate({ animation: `${pulse} 1s`, animationDuration: '5s' }).animationDuration).toBe(
      5000
    )
  })

  it('expand transition, with the property as the platform names it', () => {
    expect(translate({ transition: 'background-color 200ms ease-out 50ms, opacity 1s' })).toEqual({
      transitionProperty: ['backgroundColor', 'opacity'],
      transitionDuration: [200, 1000],
      transitionTimingFunction: ['ease-out', 'ease'],
      transitionDelay: [50, 0],
      transitionBehavior: ['normal', 'normal'],
    })
    expect(translate({ transition: '300ms' })).toMatchObject({
      transitionProperty: 'all',
      transitionDuration: 300,
    })
  })

  it('drop a shorthand with a part they cannot read, whole, with a warning', () => {
    expect(translate({ opacity: 1, animation: `${pulse} 1s 2s 3s` })).toEqual({ opacity: 1 })
    expect(translate({ opacity: 1, transition: 'opacity 1s, none' })).toEqual({ opacity: 1 })
    expect(translate({ opacity: 1, transition: 'opacity color 1s' })).toEqual({ opacity: 1 })
    expect(translate({ opacity: 1, transition: '' })).toEqual({ opacity: 1 })
    expect(translate({ opacity: 1, animation: 4 } as never)).toEqual({ opacity: 1 })
    expect(readWarnings(warn)).toEqual([
      'Pulse: "animation" cannot read "3s": the whole animation is dropped, as the web drops it.',
      'Pulse: "transition" cannot read "none": the whole transition is dropped, as the web drops it.',
      'Pulse: "transition" cannot read "color": the whole transition is dropped, as the web drops it.',
      'Pulse: "transition" cannot read "": the whole transition is dropped, as the web drops it.',
      'Pulse: "animation" cannot read "4": the whole animation is dropped, as the web drops it.',
    ])
  })
})

describe('the steps', () => {
  it('turn lengths into numbers, keep transform text, and drop what the library does not animate, with a warning', () => {
    const slide = keyframes(
      {
        from: { transform: 'translateX(-8px) rotate(45deg)', paddingTop: '1rem' },
        to: {
          transform: 'translateX(0px)',
          boxSizing: 'border-box',
          animationTimingFunction: 'steps(2)',
          animationDuration: '1s',
        },
      },
      { label: 'slide' }
    )
    const rule = translate({ animationName: slide }).animationName as library.CSSKeyframesRule
    expect(rule.cssRules).toEqual({
      '0%': { transform: 'translateX(-8px) rotate(45deg)', paddingTop: 16 },
      '100%': { transform: 'translateX(0px)', animationTimingFunction: steps(2, 'end') },
    })
    expect(readWarnings(warn)).toEqual([
      'Pulse: "animationDuration" in the step "100%" is ignored, as the web ignores it in a step.',
      'Pulse: "boxSizing" in the step "100%" is not animated by the animation library on React Native; it is dropped from the step.',
    ])
  })

  it('drop a transform the library would reject, with a warning, and give none as no transform', () => {
    const turn = keyframes(
      { from: { transform: 'none' }, to: { transform: 'rotate(1turn)', opacity: 0 } },
      { label: 'turn' }
    )
    const rule = translate({ animationName: turn }).animationName as library.CSSKeyframesRule
    expect(rule.cssRules).toEqual({ '0%': { transform: [] }, '100%': { opacity: 0 } })
    expect(readWarnings(warn)).toEqual([
      'Pulse: "transform: rotate(1turn)" in the step "100%" is not a transform the animation library reads; it is dropped from the step. Write translate, scale, rotate, skew, matrix or perspective, with lengths in px or %, and angles in deg or rad.',
    ])
  })

  it('drop an easing of a step that cannot be read', () => {
    const blink = keyframes(
      { to: { opacity: 0, animationTimingFunction: 'wobble' } },
      { label: 'blink' }
    )
    expect(
      (translate({ animationName: blink }).animationName as library.CSSKeyframesRule).cssRules
    ).toEqual({ '100%': { opacity: 0 } })
  })

  it('resolve steps given as a function of the theme against the base theme, once for each theme', () => {
    const glow = keyframes(
      (view: typeof theme) => ({
        to: { backgroundColor: view.palette.muted, padding: view.space[2] },
      }),
      { label: 'glow' }
    )
    const other = { ...theme, palette: { muted: '#000000' } }
    let base = theme
    const motion = animated.bind({ remBase: 16, readTheme: () => base })
    const first = translate({ animationName: glow }, motion)
      .animationName as library.CSSKeyframesRule
    expect(first.cssRules).toEqual({ '100%': { backgroundColor: '#cccccc', padding: 8 } })
    expect(translate({ animationName: glow }, motion).animationName).toBe(first)
    base = other
    const second = translate({ animationName: glow }, motion)
      .animationName as library.CSSKeyframesRule
    expect(second.cssRules).toEqual({ '100%': { backgroundColor: '#000000', padding: 8 } })
  })
})

describe('a part that is not valid', () => {
  it('leaves the value of the level below it, as the web leaves an earlier rule', () => {
    const style = {
      animationTimingFunction: 'linear',
      ...at(state('pressed'), { animationTimingFunction: 'wobble', opacity: 0.5 }),
    }
    const motion = animated.bind({ remBase: 16, readTheme: () => theme })
    const settings = { remBase: 16, motion }
    expect(toNativeStyle(style, undefined, settings, undefined, { pressed: true })).toEqual({
      animationTimingFunction: 'linear',
      opacity: 0.5,
    })
  })
})

describe('a styled component with the entry', () => {
  it('is wrapped once, only when its styles animate, and one that does not animate is the component of today', () => {
    const { styled } = createStyle(theme, { animated })
    const { styled: still } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Box = styled(View)({ opacity: 1 })
    const Skeleton = styled(View)({
      opacity: 1,
      animation: `${pulse} 1.5s ease-in-out infinite`,
    })
    const Other = styled(View)({ transitionProperty: 'opacity', transitionDuration: '200ms' })
    expect(Box.name).toBe(still(View)({ opacity: 1 }).name)
    render(
      <>
        <Box />
        <Skeleton />
        <Skeleton />
        <Other />
      </>
    )
    expect(createAnimatedComponent.mock.calls).toEqual([[View]])
    expect(calls[0].style).toEqual([{ opacity: 1 }])
    expect(calls[1].style).toEqual([
      expect.objectContaining({ opacity: 1, animationDuration: 1500 }),
    ])
    expect(calls[3].style).toEqual([{ transitionProperty: 'opacity', transitionDuration: 200 }])
  })

  it('finds an animation key in the native part and in a state, media or condition part, and nowhere else', () => {
    const { styled, when } = createStyle(theme, { animated })
    const { View } = createStandIn()
    const wide: string = '@media (min-width: 600px)'
    const sources = [
      { native: { transitionDuration: '1s' } },
      at(state('pressed'), { transitionDuration: '1s' }),
      { [wide]: { transitionDuration: '1s' } },
      { [when(theme)]: { transitionDuration: '1s' } },
      { shadowOffset: { width: 1, height: 1 }, web: { transitionDuration: '1s' } },
    ]
    for (const source of sources) {
      const Box = styled(View)(source as never)
      render(<Box />)
    }
    expect(createAnimatedComponent).toHaveBeenCalledTimes(1)
  })

  it('wraps the component given as `as`, once for each component', () => {
    const { styled } = createStyle(theme, { animated })
    const { View } = createStandIn()
    const { View: Card } = createStandIn('Card')
    const Skeleton = styled(View)({ animationName: pulse, animationDuration: '1s' })
    render(
      <>
        <Skeleton as={Card} />
        <Skeleton as={Card} />
      </>
    )
    expect(createAnimatedComponent.mock.calls).toEqual([[Card]])
  })

  it('is wrapped from the first render in which a function style animates, keeps the same hooks, and stays wrapped', () => {
    const { styled } = createStyle(theme, { animated })
    const { View, calls } = createStandIn('Loader')
    const Loader = styled(View)<{ isLoading?: boolean }>(({ isLoading }) => ({
      opacity: 1,
      ...(isLoading ? { animationName: pulse, animationDuration: '1s' } : {}),
    }))
    function Screen() {
      const [isLoading, setLoading] = useState(false)
      return (
        <>
          <Loader isLoading={isLoading} />
          <button type="button" onClick={() => setLoading((value) => !value)} />
        </>
      )
    }
    const { container } = render(<Screen />)
    expect(createAnimatedComponent).not.toHaveBeenCalled()
    const toggle = () => act(() => container.querySelector('button')?.click())
    toggle()
    expect(createAnimatedComponent.mock.calls).toEqual([[View]])
    expect(calls.at(-1)?.style).toEqual([expect.objectContaining({ animationDuration: 1000 })])
    toggle()
    expect(calls.at(-1)?.style).toEqual([{ opacity: 1 }])
    expect(createAnimatedComponent).toHaveBeenCalledTimes(1)
    expect(readWarnings(warn)).toEqual([
      expect.stringContaining('Loader: a function style returns an animation or transition key'),
    ])
  })

  it('keeps the press of a Pressable as state, so that its style stays a list with the transition', () => {
    const { styled } = createStyle(theme, { animated })
    const Button = styled(Pressable)({
      opacity: 1,
      transitionProperty: 'opacity',
      transitionDuration: '150ms',
      ...at(state('pressed'), { opacity: 0.7 }),
    })
    render(<Button testID="save" />)
    const record = platform.pressable('save')
    expect(record.style).toEqual([
      { opacity: 1, transitionProperty: 'opacity', transitionDuration: 150 },
    ])
    act(() => record.pressIn())
    expect(record.style).toEqual([
      { opacity: 0.7, transitionProperty: 'opacity', transitionDuration: 150 },
    ])
    act(() => record.pressOut())
    expect(record.style).toEqual([
      { opacity: 1, transitionProperty: 'opacity', transitionDuration: 150 },
    ])
    expect(createAnimatedComponent.mock.calls).toEqual([[Pressable]])
  })

  it('runs no animation and no transition while the system asks for less motion', async () => {
    const { styled } = createStyle(theme, { animated })
    const { View, calls } = createStandIn()
    const fadeIn = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } }, { label: 'fadeIn' })
    const Skeleton = styled(View)({ opacity: 1, animation: `${pulse} 1s infinite` })
    const Entrance = styled(View)({ opacity: 0, animation: `${fadeIn} 300ms forwards` })
    const Fading = styled(View)({ opacity: 1, transition: 'opacity 200ms' })
    render(
      <>
        <Skeleton />
        <Entrance />
        <Fading />
      </>
    )
    await act(async () => {})
    act(() => platform.setReducedMotion(true))
    expect(calls.slice(-3).map(({ style }) => style)).toEqual([
      [{ opacity: 1 }],
      [{ opacity: 1 }],
      [{ opacity: 1 }],
    ])
    act(() => platform.setReducedMotion(false))
    expect(calls.at(-3)?.style).toEqual([
      expect.objectContaining({ animationIterationCount: 'infinite' }),
    ])
  })
})

describe('the default style with the entry', () => {
  it('runs the animation keys once configure is given animated', () => {
    const { configure, styled } = createDefaultStyle()
    configure({ animated })
    const { View, calls } = createStandIn()
    const Skeleton = styled(View)({ animationName: pulse, animationDuration: '1s' })
    render(<Skeleton />)
    expect(calls[0].style).toEqual([
      {
        animationName: expect.objectContaining({ cssRules: PULSE_STEPS }),
        animationDuration: 1000,
      },
    ])
  })

  it('resolves steps given as a function of the theme against an empty theme when it was given none', () => {
    const { configure, styled } = createDefaultStyle()
    configure({ animated })
    const count = keyframes(
      (view: { palette?: object }) => ({ to: { opacity: view.palette ? 1 : 0 } }),
      {
        label: 'count',
      }
    )
    const { View, calls } = createStandIn()
    const Counter = styled(View)({ animationName: count })
    render(<Counter />)
    expect(calls[0].style).toEqual([
      { animationName: expect.objectContaining({ cssRules: { '100%': { opacity: 0 } } }) },
    ])
  })
})

describe('without the entry', () => {
  it('drops the animation and transition keys, says how to turn the entry on, and wraps nothing', () => {
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Skeleton = styled(View, { name: 'Still' })({
      opacity: 1,
      animation: `${pulse} 1.5s infinite`,
      transitionDuration: '200ms',
    })
    render(
      <>
        <Skeleton />
        <Skeleton />
      </>
    )
    expect(calls.map(({ style }) => style)).toEqual([[{ opacity: 1 }], [{ opacity: 1 }]])
    expect(readWarnings(warn)).toEqual([
      `Still: "animation" is dropped: ${MOTION_OFF}`,
      `Still: "transitionDuration" is dropped: ${MOTION_OFF}`,
    ])
    expect(createAnimatedComponent).not.toHaveBeenCalled()
  })
})
