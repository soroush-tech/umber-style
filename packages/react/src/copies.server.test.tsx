// Two copies of the server build of the binding in one program, as a server has them when one package is
// bundled into its build and another is left external.

/** A copy of the server build (and of the core under it), with module state of its own. */
async function loadCopy() {
  vi.resetModules()
  return import('./index.server')
}

describe('two copies of the server build', () => {
  it('share one default style, so its rules and its options are those of one engine', async () => {
    const first = await loadCopy()
    const second = await loadCopy()
    expect(second.styled).toBe(first.styled)
    expect(second.getEngine()).toBe(first.getEngine())
  })
})
