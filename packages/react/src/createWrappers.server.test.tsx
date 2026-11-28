import { createCache, createEngine, createMemorySheet, type SheetEntry } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import type { CacheFunction } from './serverContext'
import { findAll, resolveTree } from './vitest.resolveTree'

const theme = { palette: { primary: '#0000ff', surface: '#ffffff' } }
const nestedTheme = { palette: { surface: '#fff4d6' } }

type AppTheme = typeof theme

/** The slot of one request, which `React.cache` keeps inside a real server render only. */
const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

function setup() {
  const engine = createEngine(theme, {
    prefix: 'ws',
    cache: createCache({ hasLayers: false, prefix: 'ws', sheet: createMemorySheet() }),
  })
  return bindEngine(engine, requestCache)
}

describe('withTheme and withStyle in the server components build', () => {
  it('give a server component the base theme under every provider, as useTheme() does', async () => {
    const { ThemeProvider, useTheme, withTheme } = setup()
    const seen: AppTheme[] = []
    const Card = ({ id, theme: given }: { id: string; theme: AppTheme }) => {
      seen.push(given)
      return <code data-id={id}>{given.palette.surface}</code>
    }
    const ThemedCard = withTheme(Card)
    const tree = await resolveTree(
      <ThemeProvider theme={theme}>
        <ThemedCard id="outer" />
        <ThemeProvider theme={nestedTheme}>
          <ThemedCard id="nested" />
        </ThemeProvider>
      </ThemeProvider>
    )
    expect(findAll(tree, 'code').map((code) => code.children.join(''))).toEqual([
      '#ffffff',
      '#ffffff',
    ])
    expect(seen).toEqual([useTheme(), useTheme()])
    expect(seen[0]).toBe(useTheme())
    expect(ThemedCard.displayName).toBe('withTheme(Card)')
  })

  it('give the resolved entries of an object sheet and of a sheet of the theme, as useStyle(sheet) does', async () => {
    const { StyleSheet, apply, useStyle, withStyle } = setup()
    const object = StyleSheet.create({ card: { padding: 8 } })
    const themed = StyleSheet.create((current) => ({ card: { color: current.palette.primary } }))
    const seen: { card: SheetEntry }[] = []
    const Card = ({ id, styles }: { id: string; styles: { card: SheetEntry } }) => {
      seen.push(styles)
      return <p data-id={id} {...apply(styles.card)} />
    }
    const ObjectCard = withStyle(object)(Card)
    const ThemedCard = withStyle(themed)(Card)
    const tree = await resolveTree(
      <>
        <ObjectCard id="object" />
        <ThemedCard id="themed" />
      </>
    )
    expect(seen[0]).toBe(object)
    expect(seen[1].card).toBe(useStyle(themed).card)
    expect(findAll(tree, 'p').map((element) => element.props.className)).toEqual([
      String(object.card),
      String(useStyle(themed).card),
    ])
    expect(String(seen[1].card)).toMatch(/^ws-/)
  })
})
