import { findMissingStyles } from './findMissingStyles'

/** What an escape stands for when its code point is not a character. */
const REPLACEMENT = String.fromCodePoint(0xfffd)

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

  it('leaves out the theme class of a theme that declares nothing, which has no rule', () => {
    addStyle('.u-a{color:red;}')
    document.body.innerHTML = '<div class="u-theme-0 u-boundary u-scope"><p class="u-a"></p></div>'
    expect(findMissingStyles().map(({ message }) => message)).toEqual([
      'div[] has the class u-scope, which no rule names',
    ])
  })

  it('reads the rules of style elements that React hoisted, too', () => {
    addStyle('.u-a{color:red;}', 'data-precedence')
    document.body.innerHTML = '<p class="u-a"></p>'
    expect(findMissingStyles()).toEqual([])
  })

  it('reads the rules of data-umber style elements, of classes and of the global key', () => {
    addStyle('')
    const classes = document.createElement('style')
    classes.setAttribute('data-umber', 'u u-a')
    classes.textContent = '.u-a{color:var(--u-x);}'
    const global = document.createElement('style')
    global.setAttribute('data-umber', 'u-global u-theme-1')
    global.textContent = '.u-theme-1{--u-x:red;}'
    document.head.append(classes, global)
    document.body.innerHTML = '<div class="u-theme-1"><p class="u-a"></p></div>'
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

  it('finds a global rule for html, body or :root that uses a variable which nothing above declares', () => {
    addStyle(
      '@layer u-global{body{color:var(--u-x);margin:var(--u-y);padding:var(--u-z, 1px);}}' +
        ':root{background:var(--u-y);}body:hover{color:var(--u-q);}.body{color:var(--u-q);}' +
        '*{border-color:var(--u-q);}html body p{color:var(--u-q);}body .u-a{color:var(--u-q);}' +
        'html{font-family:serif;}'
    )
    document.body.innerHTML = '<p></p>'
    const problems = findMissingStyles()
    expect(problems.map((problem) => problem.message)).toEqual([
      'html[] has no value for --u-y, which the global rule :root uses: a rule for html or body sees the variables of a theme declared on :root (the outermost provider) or on <html> (its theme class)',
      'body[] has no value for --u-x, --u-y, which the global rule body uses: a rule for html or body sees the variables of a theme declared on :root (the outermost provider) or on <html> (its theme class)',
    ])
    expect(problems[1]).toMatchObject({
      kind: 'root-without-theme',
      name: '--u-x',
      element: 'body[]',
      key: 'root:body',
    })
  })

  it('finds no problem in a global rule when the theme class is on <html>, and leaves body with a class to the other check', () => {
    addStyle('.u-t{--u-x:1;}body{color:var(--u-x);}.u-a{color:red;}')
    document.documentElement.className = 'u-t'
    expect(findMissingStyles()).toEqual([])
    document.documentElement.className = ''
    document.body.className = 'u-a'
    expect(findMissingStyles()).toMatchObject([
      { kind: 'variable-without-value', key: 'variable:--u-x:body' },
    ])
    document.body.className = ''
  })

  it('finds no problem in a global rule when the root theme declares the variables on :root', () => {
    addStyle('@layer u-theme{:where(:root){--u-x:1;}}@layer u-global{html,body{color:var(--u-x);}}')
    document.body.innerHTML = '<p></p>'
    expect(findMissingStyles()).toEqual([])
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

describe('the names that findMissingStyles reads', () => {
  it('reads a class with the label of a component, upper-case letters too, in a selector and on the page', () => {
    addStyle(
      '.u-View-flex-140d3sc{display:flex;}' +
        '.u-View-flex-Sidebar-1r44ujx.u-View-flex-Sidebar-1r44ujx a{color:red;}' +
        '.u-Pressable-1lfbiv:disabled,.u-Pressable-1lfbiv[aria-disabled="true"]{opacity:0.5;}'
    )
    document.body.innerHTML =
      '<div class="u-View-flex-140d3sc"><nav class="u-View-flex-Sidebar-1r44ujx"></nav>' +
      '<div class="u-Pressable-1lfbiv"></div></div>'
    expect(findMissingStyles()).toEqual([])
  })

  it('still finds a labelled class that no rule names, also one that a named class starts with', () => {
    addStyle('.u-View-ab{display:flex;}.u-Text-é1{color:red;}')
    document.body.innerHTML = '<p class="u-View-ab u-View-a u-Text-é1 u-Text-é"></p>'
    expect(findMissingStyles().map((problem) => problem.name)).toEqual(['u-View-a', 'u-Text-é'])
  })

  it('reads the classes of selectors with combinators, pseudo-classes and escaped characters', () => {
    addStyle(
      String.raw`.u-A>.u-B~.u-C+.u-D .u-E:not(.u-F)::before{color:red;}` +
        String.raw`.u-G[data-x="1"],.u-Été:hover{color:red;}` +
        String.raw`.u-H\:md,.u-\49 cons,.u-\00004Aump,.u-\0 x{color:red;}`
    )
    const classes = ['u-A', 'u-B', 'u-C', 'u-D', 'u-E', 'u-F', 'u-G', 'u-Été']
    const escaped = ['u-H:md', 'u-Icons', 'u-Jump', `u-${REPLACEMENT}x`]
    document.body.innerHTML = [...classes, ...escaped]
      .map((name) => `<i data-testid="${name}"></i>`)
      .join('')
    for (const name of [...classes, ...escaped]) {
      document.querySelector(`[data-testid="${name}"]`)?.classList.add(name)
    }
    expect(findMissingStyles()).toEqual([])
  })

  it('reads the escapes that a browser keeps in the text of a rule, which jsdom reads itself', () => {
    // A style rule as a browser gives it: the checker tells a style rule by the name of its class.
    class CSSStyleRule {
      constructor(
        readonly selectorText: string,
        readonly cssText: string
      ) {}
    }
    // The last one ends with a backslash, which stands for nothing.
    const selector =
      String.raw`.u-H\:md,.u-\49 cons,.u-\00004Aump,.u-\0 x,.u-\110000y,.u-\d800 s,.u-\1f600 ,.u-z` +
      '\\'
    const element = document.createElement('style')
    element.setAttribute('data-style', 'u')
    document.head.appendChild(element)
    const rules = [
      new CSSStyleRule(selector, `${selector}{color:red;}`),
      new CSSStyleRule(String.raw`.u-H\:md`, String.raw`.u-H\:md{color:var(--u-b\:c);}`),
    ]
    Object.defineProperty(element, 'sheet', { value: { cssRules: rules } })
    const names = [
      'u-H:md',
      'u-Icons',
      'u-Jump',
      `u-${REPLACEMENT}x`,
      `u-${REPLACEMENT}y`,
      `u-${REPLACEMENT}s`,
    ]
    names.push('u-\u{1F600}', 'u-z')
    document.body.innerHTML = '<p></p>'
    document.querySelector('p')?.classList.add(...names)
    expect(findMissingStyles().map((problem) => problem.name)).toEqual(['--u-b:c'])
  })

  it('reads a variable with upper-case letters, and one with an escaped character', () => {
    addStyle(
      String.raw`.u-a{color:var(--u-Brand-x);margin:var(--u-b\:c);padding:var(--u-Brand-x, 1px);}`
    )
    document.body.innerHTML = '<p class="u-a"></p>'
    expect(findMissingStyles().map((problem) => problem.name)).toEqual(['--u-Brand-x', '--u-b:c'])
  })
})
