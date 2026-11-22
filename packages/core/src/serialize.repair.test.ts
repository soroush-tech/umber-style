import { alpha } from './alpha'
import { negate } from './calc'
import { DEFAULT_SCOPING } from './scope'
import { compileRules, compileStyleRules, type StyleObject, type StyleValue } from './serialize'

const MIX_1F = 'color-mix(in srgb, var(--x) 12.16%, transparent)'

/** The rules of `style` for `.a`, with `hasValueRepair`. */
const repair = (style: StyleObject) => compileRules('.a', style, true, DEFAULT_SCOPING, true)

/** The value of `color` in the rule, with `hasValueRepair`. */
const colorOf = (value: StyleValue) => {
  const [rule] = repair({ color: value })
  return rule.slice('.a{color:'.length, -';}'.length)
}

describe('compileRules with hasValueRepair: a reference followed by two hex digits', () => {
  it('writes what alpha() writes for that opacity', () => {
    expect(colorOf('var(--x)1F')).toBe(MIX_1F)
    expect(colorOf('var(--x)1f')).toBe(MIX_1F)
    for (const digits of ['00', '01', '1F', '33', '80', 'CC', 'fe', 'ff', 'FF']) {
      const opacity = Number.parseInt(digits, 16) / 255
      expect(colorOf(`var(--x)${digits}`)).toBe(String(alpha('var(--x)', opacity)))
    }
  })

  it('gives the colour itself for ff and transparent for 00', () => {
    expect(colorOf('var(--x)ff')).toBe('var(--x)')
    expect(colorOf('var(--x)00')).toBe('transparent')
  })

  it('takes in a reference with a fallback, nested references included', () => {
    expect(colorOf('var(--x, #000)1F')).toBe(
      'color-mix(in srgb, var(--x, #000) 12.16%, transparent)'
    )
    expect(colorOf('var(--x, var(--y))80')).toBe(
      'color-mix(in srgb, var(--x, var(--y)) 50.2%, transparent)'
    )
    expect(colorOf('var(--x, var(--y)1F)')).toBe(
      'var(--x, color-mix(in srgb, var(--y) 12.16%, transparent))'
    )
  })

  it('rewrites the form inside a longer value, each time it is there', () => {
    expect(repair({ border: '1px solid var(--x)1F' })).toEqual([`.a{border:1px solid ${MIX_1F};}`])
    expect(repair({ boxShadow: '0 0 4px var(--a)33, inset 0 0 1px var(--b)80' })).toEqual([
      '.a{box-shadow:0 0 4px color-mix(in srgb, var(--a) 20%, transparent), inset 0 0 1px color-mix(in srgb, var(--b) 50.2%, transparent);}',
    ])
  })

  it('leaves alone a reference that is not directly followed by exactly two hex digits', () => {
    for (const value of [
      'var(--x)',
      'var(--x) 1F',
      'var(--x),var(--y)',
      'rgb(var(--x))',
      'var(--x)/2',
      'var(--x)1Fa',
      'var(--x)1F-a',
      'var(--x)1F_',
      `var(--x)1F${String.fromCodePoint(0xe9)}`,
      'var(--x)1',
      'var(--x)1G',
      'var(--a)var(--b)',
    ]) {
      expect(colorOf(value)).toBe(value)
    }
  })
})

describe('compileRules with hasValueRepair: a minus before a reference', () => {
  it('writes what negate() writes', () => {
    expect(repair({ marginLeft: '-var(--x)' })).toEqual([
      `.a{margin-left:${String(negate('var(--x)'))};}`,
    ])
    expect(repair({ marginLeft: '-var(--x)' })).toEqual(['.a{margin-left:calc(var(--x) * -1);}'])
    expect(repair({ marginLeft: '-var(--x, 8px)' })).toEqual([
      '.a{margin-left:calc(var(--x, 8px) * -1);}',
    ])
  })

  it('rewrites a minus after a space, a comma or a parenthesis', () => {
    expect(repair({ margin: '0 -var(--x)' })).toEqual(['.a{margin:0 calc(var(--x) * -1);}'])
    expect(repair({ translate: '1px,-var(--x)' })).toEqual([
      '.a{translate:1px,calc(var(--x) * -1);}',
    ])
    expect(repair({ width: 'calc(-var(--x))' })).toEqual(['.a{width:calc(calc(var(--x) * -1));}'])
    expect(repair({ margin: 'var(--x, -var(--y))' })).toEqual([
      '.a{margin:var(--x, calc(var(--y) * -1));}',
    ])
  })

  it('leaves alone a minus that is part of valid text, and a function that only ends in var', () => {
    for (const value of [
      'calc(1px - var(--x))',
      'calc(var(--x) * -1)',
      '1px-var(--x)',
      'a-var(--x)',
      '--var(--x)',
      'xvar(--x)ff',
    ]) {
      expect(repair({ margin: value })).toEqual([`.a{margin:${value};}`])
    }
  })

  it('reads on inside another function that ends in var', () => {
    expect(colorOf('xvar(var(--x)1F)')).toBe(`xvar(${MIX_1F})`)
  })
})

describe('compileRules with hasValueRepair: a reference followed by a time unit', () => {
  it('writes a calc() of a time for ms and s, in any case', () => {
    expect(repair({ transitionDuration: 'var(--x)ms' })).toEqual([
      '.a{transition-duration:calc(var(--x) * 1ms);}',
    ])
    expect(repair({ animationDelay: 'var(--x)s' })).toEqual([
      '.a{animation-delay:calc(var(--x) * 1s);}',
    ])
    expect(repair({ animationDelay: 'var(--x, 2)MS' })).toEqual([
      '.a{animation-delay:calc(var(--x, 2) * 1ms);}',
    ])
  })

  it('rewrites the form inside a longer value, and with a minus before it', () => {
    expect(repair({ transition: 'opacity var(--d)ms ease, color var(--e)s' })).toEqual([
      '.a{transition:opacity calc(var(--d) * 1ms) ease, color calc(var(--e) * 1s);}',
    ])
    expect(repair({ animationDelay: '-var(--d)ms' })).toEqual([
      '.a{animation-delay:calc((var(--d) * 1ms) * -1);}',
    ])
  })

  it('leaves alone a unit that goes on, and a length unit', () => {
    for (const value of ['var(--x)msa', 'var(--x)sec', 'var(--x)s2', 'var(--x)px', 'var(--x)%']) {
      expect(repair({ width: value })).toEqual([`.a{width:${value};}`])
    }
  })
})

describe('compileRules with hasValueRepair: where it applies', () => {
  it('rewrites each item of a fallback list, and leaves an alpha() result as it was', () => {
    expect(repair({ color: ['var(--x)1F', 'red'] })).toEqual([`.a{color:${MIX_1F};color:red;}`])
    const mix = alpha('var(--x)', 0.5)
    expect(repair({ color: mix })).toEqual(compileRules('.a', { color: mix }))
  })

  it('leaves a custom property alone', () => {
    expect(repair({ '--tint': 'var(--x)1F', '--gap': '-var(--x)' })).toEqual([
      '.a{--tint:var(--x)1F;--gap:-var(--x);}',
    ])
  })

  it('leaves alone a value without a reference, a number, and a reference that is not closed', () => {
    expect(
      repair({ color: '#0000001F', padding: 4, width: 'var(--x', margin: 'var(--x)1F var(--y' })
    ).toEqual([`.a{color:#0000001F;padding:4px;width:var(--x;margin:${MIX_1F} var(--y;}`])
  })

  it('reaches nested selectors, at-rules and conditions', () => {
    expect(
      repair({ '&:hover': { color: 'var(--x)1F' }, '@media print': { margin: '-var(--x)' } })
    ).toEqual([`.a:hover{color:${MIX_1F};}`, '@media print{.a{margin:calc(var(--x) * -1);}}'])
  })

  it('writes every form as it is without the option', () => {
    const style = {
      color: 'var(--x)1F',
      margin: '0 -var(--x)',
      transition: 'opacity var(--d)ms',
      background: ['var(--x)80', 'red'],
    }
    expect(compileRules('.a', style)).toEqual([
      '.a{color:var(--x)1F;margin:0 -var(--x);transition:opacity var(--d)ms;background:var(--x)80;background:red;}',
    ])
    expect(compileRules('.a', style, true, DEFAULT_SCOPING, false)).toEqual(
      compileRules('.a', style)
    )
  })
})

describe('compileStyleRules with hasValueRepair: a reference followed by a length or another unit', () => {
  const VALUES: Record<string, string> = {
    '--px': '4px',
    '--rem': '1.5rem',
    '--plain': '2',
    '--ms': '150ms',
    '--color': '#fff',
  }
  /** The rules of `style` for `.a` with value repair, the values above, and what is reported. */
  const repairWith = (style: StyleObject) => {
    const reported: string[] = []
    const rules = compileStyleRules('.a', style, {
      hasColorFallbacks: true,
      hasValueRepair: true,
      scoping: DEFAULT_SCOPING,
      readValue: (name) => VALUES[name],
      report: (message) => reported.push(message),
    })
    return { rules, reported }
  }

  it('writes the bare reference when the value of the token has that unit', () => {
    expect(repairWith({ fontSize: 'var(--px)px', margin: '0 var(--rem)rem' }).rules).toEqual([
      '.a{font-size:var(--px);margin:0 var(--rem);}',
    ])
    expect(repairWith({ transitionDuration: 'var(--ms)ms' }).rules).toEqual([
      '.a{transition-duration:var(--ms);}',
    ])
    expect(repairWith({ width: 'var(--px)PX' }).rules).toEqual(['.a{width:var(--px);}'])
  })

  it('writes a calc() of the unit when the value of the token is a plain number', () => {
    const units = ['px', 'rem', 'em', '%', 'vh', 'vw', 'vmin', 'vmax', 'dvh', 'ch', 'deg', 'turn']
    for (const unit of units) {
      expect(repairWith({ width: `var(--plain)${unit}` }).rules).toEqual([
        `.a{width:calc(var(--plain) * 1${unit});}`,
      ])
    }
    expect(repairWith({ marginTop: '-var(--plain)px' }).rules).toEqual([
      '.a{margin-top:calc((var(--plain) * 1px) * -1);}',
    ])
  })

  it('reads the unit of the fallback of a reference whose value is not known', () => {
    expect(repairWith({ width: 'var(--gap, 8px)px', height: 'var(--n, 3)px' }).rules).toEqual([
      '.a{width:var(--gap, 8px);height:calc(var(--n, 3) * 1px);}',
    ])
  })

  it('reads a number in every form it is written in', () => {
    const widthOf = (fallback: string, unit: string) =>
      repairWith({ width: `var(--n, ${fallback})${unit}` }).rules[0].slice('.a{width:'.length, -2)
    // A sign, a number that starts or ends with its point, and an exponent in either case.
    for (const value of ['+4px', '-4px', '.5px', '5.px']) {
      expect(widthOf(value, 'px')).toBe(`var(--n, ${value})`)
    }
    for (const value of ['1e3', '2E-2', '1e+2']) {
      expect(widthOf(value, 'px')).toBe(`calc(var(--n, ${value}) * 1px)`)
    }
    // An `e` with no digit after it starts a unit.
    expect(widthOf('2em', 'em')).toBe('var(--n, 2em)')
    expect(widthOf('2ex', 'ex')).toBe('var(--n, 2ex)')
    // No digit at all, and text after the unit, are not a number with a unit: the form is left.
    for (const value of ['.', 'e3', '-', '4px solid']) {
      expect(widthOf(value, 'px')).toBe(`var(--n, ${value})px`)
    }
  })

  it('leaves a reference with another unit, another value or no known value as it is, and reports it', () => {
    const { rules, reported } = repairWith({
      width: 'var(--rem)px',
      height: 'var(--color)px',
      top: 'var(--other)px',
      left: 'var(--px)ms',
    })
    expect(rules).toEqual([
      '.a{width:var(--rem)px;height:var(--color)px;top:var(--other)px;left:var(--px)ms;}',
    ])
    expect(reported).toEqual([
      '.a declares width:var(--rem)px, which puts "px" after var(--rem), whose value 1.5rem has another unit: it is left as it is, and the browser drops it. Write the value in px, or the reference alone.',
      '.a declares height:var(--color)px, which puts "px" after var(--color), whose value #fff is not a number: it is left as it is, and the browser drops it. Write the reference alone.',
      '.a declares top:var(--other)px, which puts "px" after var(--other), whose value is not known (no token of the theme has it): it is left as it is, and the browser drops it. Write calc(var(--other) * 1px) for a number, or the reference alone for a length.',
      '.a declares left:var(--px)ms, which puts "ms" after var(--px), whose value 4px has another unit: it is left as it is, and the browser drops it. Write the value in ms, or the reference alone.',
    ])
  })

  it('keeps the calc() of a time for a reference whose value is not known', () => {
    expect(repairWith({ transitionDelay: 'var(--other)ms' }).rules).toEqual([
      '.a{transition-delay:calc(var(--other) * 1ms);}',
    ])
  })
})
