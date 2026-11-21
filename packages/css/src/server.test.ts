// @vitest-environment node
import createInstance from './createInstance'
import { cache, css, cx, injectGlobal, keyframes, sheet } from './index'

describe('on a server, where there is no document', () => {
  it('keeps the rules in memory, and the cache extracts them with their ids', () => {
    injectGlobal({ body: { margin: 0 } })
    const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
    const card = css({ padding: 8, animation: `${fade} 1s` })
    const title = cx(card, css({ color: 'red' }))
    const { css: text, ids } = cache.extract()
    expect(sheet.rules).toEqual([
      'body{margin:0;}',
      `@keyframes ${fade}{0%{opacity:0;}100%{opacity:1;}}`,
      `.${card}{padding:8px;animation:${fade} 1s;}`,
      `.${css({ color: 'red' })}{color:red;}`,
      `.${title}{padding:8px;animation:${fade} 1s;color:red;}`,
    ])
    expect(text).toBe(sheet.rules.join(''))
    expect(ids).toEqual(expect.arrayContaining([card, title, `@keyframes:${fade}`]))
    expect(ids.some((id) => id.startsWith('css-global-'))).toBe(true)
  })

  it('makes a separate instance with an in-memory sheet', () => {
    const { css: make, sheet: own } = createInstance({ key: 'srv' })
    const name = make({ color: 'red' })
    expect(own.rules).toEqual([`.${name}{color:red;}`])
  })
})
