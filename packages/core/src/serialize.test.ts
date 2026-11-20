import { compileRules, mergeStyles, readLabel } from './serialize'

describe('compileRules', () => {
  it('compiles declarations into one rule', () => {
    expect(compileRules('.a', { color: 'red', backgroundColor: 'blue' })).toEqual([
      '.a{color:red;background-color:blue;}',
    ])
  })

  it('turns a leading ms into -ms-', () => {
    expect(compileRules('.a', { msTransform: 'none' })).toEqual(['.a{-ms-transform:none;}'])
  })

  it('gives numbers px, except 0, unitless properties and custom properties', () => {
    expect(
      compileRules('.a', { padding: 4, margin: 0, opacity: 0.5, zIndex: 3, '--gap': 8 })
    ).toEqual(['.a{padding:4px;margin:0;opacity:0.5;z-index:3;--gap:8;}'])
  })

  it('gives a number of a duration or a delay ms, 0 too, and leaves a string of one as written', () => {
    expect(
      compileRules('.a', {
        animationDuration: 1500,
        animationDelay: -200,
        transitionDuration: 0,
        transitionDelay: 0.5,
      })
    ).toEqual([
      '.a{animation-duration:1500ms;animation-delay:-200ms;transition-duration:0ms;transition-delay:0.5ms;}',
    ])
    expect(compileRules('.a', { animationDuration: '1.5s', transitionDelay: ['0s', 100] })).toEqual(
      ['.a{animation-duration:1.5s;transition-delay:0s;transition-delay:100ms;}']
    )
    expect(compileRules('.a', { animationIterationCount: 2 })).toEqual([
      '.a{animation-iteration-count:2;}',
    ])
  })

  it('leaves custom properties as written', () => {
    expect(compileRules('.a', { '--fooBar': 'x' })).toEqual(['.a{--fooBar:x;}'])
  })

  it('emits an array value once per item', () => {
    expect(compileRules('.a', { width: ['100%', 'calc(100% - 4px)', 5] })).toEqual([
      '.a{width:100%;width:calc(100% - 4px);width:5px;}',
    ])
  })

  it('skips null, undefined, false and the label', () => {
    expect(
      compileRules('.a', { color: null, margin: undefined, padding: false, label: 'x' })
    ).toEqual([])
  })

  it('nests a selector with &', () => {
    expect(
      compileRules('.a', {
        color: 'red',
        '&:hover': { color: 'blue' },
        '& > span': { margin: 2 },
      })
    ).toEqual(['.a{color:red;}', '.a:hover{color:blue;}', '.a > span{margin:2px;}'])
  })

  it('splits a comma list and replaces & in each part', () => {
    expect(compileRules('.a', { '&:hover, &:focus-visible': { color: 'blue' } })).toEqual([
      '.a:hover,.a:focus-visible{color:blue;}',
    ])
  })

  it('keeps a comma inside parentheses and brackets in its part', () => {
    expect(
      compileRules('.a', { '&:is(.b, .c)': { color: 'x' }, '&[data-x="1,2"]': { top: 1 } })
    ).toEqual(['.a:is(.b, .c){color:x;}', '.a[data-x="1,2"]{top:1px;}'])
  })

  it('treats a key with no & as a descendant', () => {
    expect(compileRules('.a', { span: { color: 'red' } })).toEqual(['.a span{color:red;}'])
  })

  it('treats a key that starts with a colon as the element itself, like a key that starts with &', () => {
    expect(
      compileRules('.a', {
        ':hover': { color: 'red' },
        ':is(.b, .c):focus, :first-child': { top: 1 },
        '::before': { content: '""' },
        'span :hover': { color: 'blue' },
      })
    ).toEqual([
      '.a:hover{color:red;}',
      '.a:is(.b, .c):focus,.a:first-child{top:1px;}',
      '.a::before{content:"";}',
      '.a span :hover{color:blue;}',
    ])
  })

  it('crosses nested comma lists with a comma list parent', () => {
    expect(
      compileRules('.a', { '&:hover, &:focus': { '& > span, em': { color: 'red' } } })
    ).toEqual(['.a:hover > span,.a:focus > span,.a:hover em,.a:focus em{color:red;}'])
  })

  it('wraps rules in an at-rule, including nested selectors', () => {
    expect(
      compileRules('.a', {
        color: 'red',
        '@media (width >= 600px)': { color: 'blue', '&:hover': { color: 'green' } },
      })
    ).toEqual([
      '.a{color:red;}',
      '@media (width >= 600px){.a{color:blue;}}',
      '@media (width >= 600px){.a:hover{color:green;}}',
    ])
  })

  it('omits the own rule when there are no declarations', () => {
    expect(compileRules('.a', { '&:hover': { color: 'red' } })).toEqual(['.a:hover{color:red;}'])
  })
})

describe('mergeStyles', () => {
  it('lets a later key win and move to the end', () => {
    const merged = mergeStyles([{ padding: 4, color: 'red' }, { color: 'blue' }, { padding: 8 }])
    expect(Object.keys(merged)).toEqual(['color', 'padding'])
    expect(merged).toEqual({ color: 'blue', padding: 8 })
  })

  it('merges nested objects deeply', () => {
    const merged = mergeStyles([
      { '&:hover': { color: 'red', margin: 1 } },
      { '&:hover': { color: 'blue' } },
    ])
    expect(merged).toEqual({ '&:hover': { margin: 1, color: 'blue' } })
  })

  it('replaces an object with a plain value and the other way round', () => {
    expect(mergeStyles([{ a: { b: 1 } }, { a: 'x' }])).toEqual({ a: 'x' })
    expect(mergeStyles([{ a: 'x' }, { a: { b: 1 } }])).toEqual({ a: { b: 1 } })
    expect(mergeStyles([{ a: [1] }, { a: { b: 1 } }])).toEqual({ a: { b: 1 } })
  })

  it('does not change its inputs', () => {
    const first = { '&:hover': { color: 'red' } }
    const second = { '&:hover': { color: 'blue' } }
    mergeStyles([first, second])
    expect(first).toEqual({ '&:hover': { color: 'red' } })
    expect(second).toEqual({ '&:hover': { color: 'blue' } })
  })
})

describe('the platform parts of a style written for both platforms', () => {
  it('merges the web part over the rest and drops the native part', () => {
    const merged = mergeStyles([
      {
        padding: 8,
        color: 'red',
        web: { color: 'blue', '&:hover': { opacity: 0.8 } },
        native: { elevation: 2 },
      },
    ])
    expect(merged).toEqual({ padding: 8, color: 'blue', '&:hover': { opacity: 0.8 } })
    expect(Object.keys(merged)).toEqual(['padding', 'color', '&:hover'])
  })

  it('merges a web part into nested keys of the rest', () => {
    const merged = mergeStyles([{ '&:hover': { color: 'red' }, web: { '&:hover': { margin: 1 } } }])
    expect(merged).toEqual({ '&:hover': { color: 'red', margin: 1 } })
  })

  it('drops a part that is not an object', () => {
    expect(mergeStyles([{ padding: 8, web: undefined }])).toEqual({ padding: 8 })
    expect(mergeStyles([{ padding: 8, web: false, native: null }])).toEqual({ padding: 8 })
  })

  it('leaves a style without parts as it is', () => {
    const style = { padding: 8 }
    expect(mergeStyles([style])).toEqual(style)
  })
})

describe('readLabel', () => {
  it('reads the label key', () => {
    expect(readLabel({ label: 'button-root' })).toBe('button-root')
  })

  it('returns an empty string without a label', () => {
    expect(readLabel({ color: 'red' })).toBe('')
  })
})
