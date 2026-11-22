// Two copies of the core in one program, as an app has them when one package is bundled into a build
// and another is left external: each copy has its own module state, and both see one `globalThis`.

/** A copy of the whole core, with module state of its own. */
async function loadCopy() {
  vi.resetModules()
  return import('./index')
}

afterEach(() => {
  document.head.innerHTML = ''
})

describe('two copies of the core', () => {
  it('know the keyframes names of each other: a cache of one writes the rule of a name the other returned', async () => {
    const first = await loadCopy()
    const second = await loadCopy()
    expect(second.keyframes).not.toBe(first.keyframes)
    const fade = first.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
    const sheet = second.createMemorySheet()
    const cache = second.createCache({ prefix: 'twin', hasLayers: false, sheet })
    cache.insertKeyframes(fade)
    const card = cache.css({ animation: `${fade} 1s` })
    expect(sheet.rules).toEqual([
      `@keyframes ${fade}{0%{opacity:0;}100%{opacity:1;}}`,
      `.${card}{animation:${fade} 1s;}`,
    ])
  })

  it('find the cache of a page that the other made', async () => {
    const first = await loadCopy()
    const second = await loadCopy()
    const cache = first.createCache({ prefix: 'twin-page', hasDevChecks: false })
    expect(second.findCache('twin-page', document)).toBe(cache)
  })

  it('write a style element by text as two caches of one copy do, and do not take the rules of the other for rules a server sent', async () => {
    const write = (copies: Awaited<ReturnType<typeof loadCopy>>[], prefix: string) => {
      const options = { prefix, hasDevChecks: false, hasRuleText: true }
      const one = copies[0].createCache(options)
      one.css({ color: 'red' })
      const release = one.insertGlobal(one.compileGlobal({ body: { margin: 0 } }))
      // Made after the first one wrote: it reads the element, and the rules of the first are not sent ones.
      const two = copies[1].createCache(options)
      two.css({ color: 'red' })
      two.insertGlobal(two.compileGlobal({ body: { margin: 0 } }))
      release()
      const elements = [...document.querySelectorAll(`style[data-style="${prefix}"]`)]
      return [two.extract().css, ...elements.map((element) => element.textContent)].map((text) =>
        text?.replaceAll(prefix, 'p')
      )
    }
    const single = await loadCopy()
    const alone = write([single, single], 'solo')
    expect(alone[0]).toContain('body{margin:0;}')
    expect(write([await loadCopy(), await loadCopy()], 'pair')).toEqual(alone)
  })

  it('keep a cache that writes by insertRule out of the element that a cache of the other writes by text', async () => {
    const first = await loadCopy()
    const second = await loadCopy()
    const byText = first.createCache({ prefix: 'mixed', hasDevChecks: false, hasRuleText: true })
    byText.css({ color: 'red' })
    const byRules = second.createCache({ prefix: 'mixed', hasDevChecks: false, hasRuleText: false })
    const margin = byRules.css({ margin: 0 })
    byText.css({ padding: 1 })
    const elements = [...document.querySelectorAll<HTMLStyleElement>('style[data-style="mixed"]')]
    expect(elements).toHaveLength(2)
    const rules = elements.flatMap((element) =>
      [...(element.sheet?.cssRules ?? [])].map((rule) => rule.cssText)
    )
    expect(rules.join('')).toContain(`.${margin}`)
  })

  it('find the labels of a component that the other made, in the class of a wrapper', async () => {
    const first = await loadCopy()
    const second = await loadCopy()
    const sheet = first.createMemorySheet()
    const inner = first
      .createEngine({}, { cache: first.createCache({ prefix: 'lab', hasLayers: false, sheet }) })
      .createStyler({ name: 'Inner' }, [{ color: 'red' }, ({ wide }) => ({ width: wide ? 2 : 1 })])
    const outerEngine = second.createEngine(
      {},
      {
        cache: second.createCache({
          prefix: 'lab',
          hasLayers: false,
          sheet: second.createMemorySheet(),
        }),
      }
    )
    const outer = outerEngine.createStyler({ name: 'Outer' }, [{ margin: 1 }], inner.styles)
    // The class of the props, which only the wrapper makes, carries the labels of both.
    const [base, own] = outer.getClassName({ wide: true }).split(' ')
    expect(base).toMatch(/^lab-inner-root-outer-root-\w+$/)
    expect(own).toMatch(/^lab-inner-root-outer-root-\w+$/)
    expect(outerEngine.cache.extract().css).toBe(
      `.${base}{color:red;}.${own}{width:2px;margin:1px;}`
    )
  })
})
