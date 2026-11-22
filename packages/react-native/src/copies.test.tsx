// Two copies of the binding in one program, as an app has them when one package carries its own copy:
// each has its own module state.

/** A copy of a module of the binding (and of the core under it), with module state of its own. */
async function loadCopy<T>(load: () => Promise<T>): Promise<T> {
  vi.resetModules()
  return load()
}

const dark = { palette: { primary: '#8888ff' } }
const other = { palette: { primary: '#00ff00' } }

describe('two copies of the React Native binding', () => {
  it('share one default style', async () => {
    const first = await loadCopy(() => import('./index'))
    const second = await loadCopy(() => import('./index'))
    expect(second.styled).toBe(first.styled)
  })

  it('give two themes two keys, and match a key of one copy in the other', async () => {
    const first = await loadCopy(() => import('./conditions'))
    const second = await loadCopy(() => import('./conditions'))
    const darkKey = first.createNativeThemeKey(dark)
    const otherKey = second.createNativeThemeKey(other)
    expect(otherKey).not.toBe(darkKey)
    expect(second.matchesCondition(darkKey, { theme: dark, colorScheme: undefined })).toBe(true)
    expect(second.matchesCondition(darkKey, { theme: other, colorScheme: undefined })).toBe(false)
  })
})
