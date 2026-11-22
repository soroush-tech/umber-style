// Two copies of the package in one program, as an app has them when one package is bundled into a build
// and another is left external: each has its own module state.

/** A copy of the package (and of the core under it), with module state of its own. */
async function loadCopy() {
  vi.resetModules()
  return import('./index')
}

afterEach(() => {
  document.head.innerHTML = ''
})

describe('two copies of the package', () => {
  it('share the default instance: a class one made is merged and extracted by the other', async () => {
    const first = await loadCopy()
    const second = await loadCopy()
    expect(second.cache).toBe(first.cache)
    const card = first.css({ padding: 8 })
    const merged = second.cx(card, second.css({ color: 'red' }))
    expect(second.cache.extract().css).toContain(`.${merged}{padding:8px;color:red;}`)
  })
})
