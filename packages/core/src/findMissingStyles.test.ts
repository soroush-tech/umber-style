import { findMissingStyles } from './findMissingStyles'

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

function addStyle(
  css: string,
  attribute: 'data-style' | 'data-precedence' = 'data-style',
  prefix = 'u'
) {
  const element = document.createElement('style')
  element.setAttribute(attribute, prefix)
  element.textContent = css
  document.head.appendChild(element)
}

describe('findMissingStyles', () => {
  it('finds nothing on a page with no engine, or without a prefix to look for', () => {
    document.body.innerHTML = '<p class="u-a">'
    expect(findMissingStyles()).toEqual([])
    expect(findMissingStyles(document.body)).toEqual([])
  })

  it('finds nothing when every class has a rule and every variable has a value', () => {
    addStyle('.u-theme-1{--u-x:red;}.u-a{color:var(--u-x);}')
    document.body.innerHTML =
      '<div class="u-theme-1 u-boundary u-scheme-light"><p class="u-a plain"></p></div>'
    expect(findMissingStyles()).toEqual([])
    expect(findMissingStyles(document.body)).toEqual([])
    expect(findMissingStyles(document.querySelector('p') as Element)).toEqual([])
  })

  it('reads the rules of style elements that React hoisted, too', () => {
    addStyle('.u-a{color:red;}', 'data-precedence')
    document.body.innerHTML = '<p class="u-a"></p>'
    expect(findMissingStyles()).toEqual([])
  })

  it('finds a class that no rule names, and describes the element', () => {
    addStyle('.u-a{color:red;}')
    document.body.innerHTML =
      '<p data-testid="one" class="u-a u-b"></p><i id="two" class="u-c"></i>'
    const problems = findMissingStyles()
    expect(problems.map((problem) => problem.message)).toEqual([
      'p[one] has the class u-b, which no rule names',
      'i[two] has the class u-c, which no rule names',
    ])
    expect(problems[0]).toMatchObject({
      kind: 'class-without-rule',
      name: 'u-b',
      element: 'p[one]',
      key: 'class:u-b',
    })
  })

  it('finds a variable with no value on the element that a matched rule is for', () => {
    addStyle('.u-a{color:var(--u-x);margin:var(--u-y, 1px);padding:var(--u-z);}.u-b{color:red;}')
    document.body.innerHTML = '<div style-test="1"><p data-testid="one" class="u-a u-b"></p></div>'
    const problems = findMissingStyles()
    expect(problems.map((problem) => problem.name)).toEqual(['--u-x', '--u-z'])
    expect(problems[0]).toMatchObject({
      kind: 'variable-without-value',
      element: 'p[one]',
      key: 'variable:--u-x:.u-a',
    })
    expect(problems[0].message).toBe('p[one] has no value for --u-x, which .u-a uses')
  })

  it('leaves out a variable that has a value from an ancestor, and a rule for a state', () => {
    addStyle('.u-t{--u-x:1;}.u-a{color:var(--u-x);}.u-a:hover{color:var(--u-q);}')
    document.body.innerHTML = '<div class="u-t"><p class="u-a"></p></div>'
    expect(findMissingStyles()).toEqual([])
  })

  it('does not look at a rule that is not for the element, and survives a selector that cannot be matched', () => {
    addStyle('.u-a{color:var(--u-x);}.u-c{color:var(--u-y);}')
    document.body.innerHTML = '<p class="u-c"></p>'
    expect(findMissingStyles().map((problem) => problem.name)).toEqual(['--u-y'])
    vi.spyOn(Element.prototype, 'matches').mockImplementation(() => {
      throw new SyntaxError('not a selector')
    })
    expect(findMissingStyles()).toEqual([])
    vi.restoreAllMocks()
  })

  it('looks only at the elements under the root it is given', () => {
    addStyle('.u-a{color:red;}')
    document.body.innerHTML = '<p class="u-x"></p><div id="in"><p class="u-y"></p></div>'
    const problems = findMissingStyles(document.getElementById('in') as Element)
    expect(problems.map((problem) => problem.name)).toEqual(['u-y'])
  })

  it('takes the prefix from the option, over the page', () => {
    addStyle('.u-a{color:red;}')
    addStyle('.v-a{color:red;}', 'data-style', 'v')
    document.body.innerHTML = '<p class="v-a u-b"></p>'
    expect(findMissingStyles(document, { prefix: 'v' }).map((problem) => problem.name)).toEqual([])
    expect(findMissingStyles(document, { prefix: 'u' }).map((problem) => problem.name)).toEqual([
      'u-b',
    ])
    expect(findMissingStyles().map((problem) => problem.name)).toEqual(['u-b'])
  })

  it('goes into the rules of at-rules, passes the ones with no rules, and leaves out other variables', () => {
    addStyle(
      '@layer u-a,u-b;@property --u-p{syntax:"<color>";inherits:true;initial-value:red;}' +
        '@media (min-width: 1px){.u-a{color:var(--u-x);margin:var(--other-x);}}'
    )
    document.body.innerHTML = '<p class="u-a"></p>'
    expect(findMissingStyles().map((problem) => problem.name)).toEqual(['--u-x'])
  })

  it('ignores a style element that has no sheet', () => {
    const element = document.createElement('style')
    element.setAttribute('data-style', 'u')
    element.setAttribute('type', 'text/plain')
    element.textContent = '.u-a{color:red;}'
    document.head.appendChild(element)
    document.body.innerHTML = '<p class="u-a"></p>'
    expect(findMissingStyles().map((problem) => problem.name)).toEqual(['u-a'])
  })
})
