// The server build takes the same style type: `pnpm typecheck` compiles this file.
import { createStyle } from './createStyle.server'

describe('the style type of the server build', () => {
  it('accepts a web style and rejects a misspelt property', () => {
    const { styled, StyleSheet } = createStyle({ palette: { primary: '#0000ff' } })
    styled('div')({ padding: 8, '&:hover': { opacity: 0.8 }, '--x': 1, label: 'a' })
    // @ts-expect-error `backgroudColor` is not a property
    styled('div')({ backgroudColor: 'red' })
    StyleSheet.create({ box: { display: 'block flex' } })
    // @ts-expect-error `gird` is not a display value
    StyleSheet.create({ box: { display: 'gird' } })
  })
})
