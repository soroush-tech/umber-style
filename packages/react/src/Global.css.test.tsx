import { render } from '@testing-library/react'
import { createCache, type CSSObject, type Sheet } from '@umber-style/core'
import { CacheProvider } from './CacheProvider'
import { createStyle } from './createStyle'

const theme = {
  colorScheme: 'light',
  background: { primary: '#ffffff' },
  text: { initial: '#111111' },
  breakpoints: {
    values: { lg: 1200 },
    up: (key: 'lg') => `@media (min-width: ${theme.breakpoints.values[key]}px)`,
  },
}

/** A style whose keys are selectors with no `&`, which the strict style types do not take: what a reset is. */
const asStyle = (style: object) => style as CSSObject

/** A style over an in-memory sheet without layers that logs each rule it inserts and removes. */
function setup(hasDevChecks = false) {
  const rules: string[] = []
  const log: string[] = []
  const sheet: Sheet = {
    rules,
    insert(rule) {
      rules.push(rule)
      log.push(`+${rule}`)
    },
    remove(index) {
      log.push(`-${rules[index]}`)
      rules.splice(index, 1)
    },
  }
  const cache = createCache({ prefix: 'g', sheet, hasLayers: false, hasDevChecks })
  return { ...createStyle(theme, { prefix: 'g', cache }), cache, rules, log }
}

/** The rules the app's reset writes, in order. */
const RESET_RULES = [
  '*,*::before,*::after{box-sizing:border-box;}',
  'html,body{margin:0;color-scheme:var(--g-color-scheme);}',
  'body{background:var(--g-background-primary);color:var(--g-text-initial);}',
  'p,h1,h2,h3,h4,h5,h6{margin:0;}',
  'td,th{padding:0;}',
  '#root,main [id]{isolation:isolate;}',
  '@media (min-width: 1200px){main [id]{scroll-margin-top:5rem;}}',
]

/** The app's reset: a function of the theme that returns a `css` template. */
function createReset(css: ReturnType<typeof setup>['css']) {
  return (view: typeof theme) => css`
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }
    html,
    body {
      margin: 0;
      color-scheme: ${view.colorScheme};
    }
    /* the page */
    body {
      background: ${view.background.primary};
      color: ${view.text.initial};
    }
    p,
    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      margin: 0;
    }
    td,
    th {
      padding: 0;
    }
    #root,
    main [id] {
      isolation: isolate;
    }
    ${view.breakpoints.up('lg')} {
      main [id] {
        scroll-margin-top: 5rem;
      }
    }
  `
}

describe('Global given a css value', () => {
  it('writes a function of the theme that returns a css template as global rules', () => {
    const { Global, css, rules } = setup()
    const { unmount } = render(<Global styles={createReset(css)} />)
    expect(rules).toEqual(RESET_RULES)
    unmount()
    expect(rules).toEqual([])
  })

  it('writes a list of an object and the reset, in order', () => {
    const { Global, css, rules } = setup()
    render(<Global styles={[{ '#app': { minHeight: '100%' } }, createReset(css)]} />)
    expect(rules).toEqual(['#app{min-height:100%;}', ...RESET_RULES])
  })

  it('writes a css template, a css value of an object and a globalStyles handle, in order', () => {
    const { Global, css, globalStyles, rules } = setup()
    const template = css`
      html {
        margin: 0;
      }
    `
    const object = css(asStyle({ 'html, body': { padding: 0 } }))
    const handle = globalStyles(() => ({ body: { color: 'red' } }))
    render(<Global styles={[template, object, handle]} />)
    expect(rules).toEqual(['html{margin:0;}', 'html,body{padding:0;}', 'body{color:red;}'])
  })

  it('replaces the rules of a css value when it changes, and writes them under a CacheProvider', () => {
    const { Global, css, rules, log } = setup()
    const { rerender } = render(<Global styles={css(asStyle({ body: { margin: 0 } }))} />)
    rerender(<Global styles={css(asStyle({ body: { margin: 8 } }))} />)
    expect(rules).toEqual(['body{margin:8px;}'])
    expect(log).toEqual(['+body{margin:0;}', '+body{margin:8px;}', '-body{margin:0;}'])
    const provided = createCache({ prefix: 'p', hasLayers: false })
    render(
      <CacheProvider value={provided}>
        <Global styles={createReset(css)} />
      </CacheProvider>
    )
    expect(provided.extract().css).toContain(
      'html,body{margin:0;color-scheme:var(--p-color-scheme);}'
    )
  })

  it('leaves out a declaration of a css value that has no selector, and warns in development', () => {
    const { Global, css, rules } = setup(true)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    render(<Global styles={css(asStyle({ label: 'Reset', color: 'red', body: { margin: 0 } }))} />)
    expect(rules).toEqual(['body{margin:0;}'])
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      '[g] Global styles: the css() value "Reset" declares "color" outside a selector. A global rule needs a selector, so it is left out: put it under one (html, body, :root).',
    ])
    warn.mockRestore()
  })
})
