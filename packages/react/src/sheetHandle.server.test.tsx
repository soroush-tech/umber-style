import { createCache, createEngine, createMemorySheet } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import type { CacheFunction } from './serverContext'
import { findAll, resolveTree, type ResolvedElement } from './vitest.resolveTree'

const theme = { palette: { primary: '#0000ff' }, space: [0, 4, 8] }

const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

function setup() {
  const engine = createEngine(theme, {
    prefix: 's',
    cache: createCache({ prefix: 's', sheet: createMemorySheet() }),
  })
  return bindEngine(engine, requestCache)
}

const classOf = (element: ResolvedElement) => element.props.className as string

/** The element of `tree` whose id is `id`. */
const byId = (tree: Awaited<ReturnType<typeof resolveTree>>, id: string) =>
  findAll(tree, 'div').find((element) => element.props.id === id) as ResolvedElement

describe('a handle of a sheet in the server components build', () => {
  it('gives style={sheet.key} the class of useStyle(sheet).key, under nested providers too', async () => {
    const { styled, StyleSheet, useStyle, ThemeProvider } = setup()
    const sheet = StyleSheet.create((view) => ({ box: { padding: view.space[2] } }))
    const Static = styled('div')({ display: 'block' })
    const Dynamic = styled('div')(({ theme: view }) => ({ margin: view.space[1] }))
    const Probe = () => {
      const styles = useStyle(sheet)
      return (
        <>
          <Static id="sh" style={sheet.box} />
          <Static id="sk" style={styles.box} />
          <Dynamic id="dh" style={[sheet.box, false, { width: 1 }]} />
          <Dynamic id="dk" style={[styles.box, false, { width: 1 }]} />
        </>
      )
    }
    const tree = await resolveTree(
      <ThemeProvider theme={theme}>
        <ThemeProvider theme={{ palette: { primary: '#ff0000' } }}>
          <Probe />
        </ThemeProvider>
      </ThemeProvider>
    )
    expect(classOf(byId(tree, 'sh'))).toBe(classOf(byId(tree, 'sk')))
    expect(classOf(byId(tree, 'dh'))).toBe(classOf(byId(tree, 'dk')))
  })

  it('has a key that holds null, which React reads for its messages of development', () => {
    const { StyleSheet } = setup()
    const sheet = StyleSheet.create((view) => ({ box: { padding: view.space[2] } }))
    expect(Object.values(sheet.box)).toEqual([null])
  })

  it('is a TypeError in apply', () => {
    const { StyleSheet, apply } = setup()
    const sheet = StyleSheet.create((view) => ({ box: { padding: view.space[2] } }))
    expect(() => apply(sheet.box as never)).toThrow(/^apply\(\): /)
  })
})
