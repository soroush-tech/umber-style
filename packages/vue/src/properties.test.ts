import { alpha, createCache, createMemorySheet } from '@umber-style/core'
import { createStyle } from './createStyle'

const theme = { palette: { primary: '#0000ff' } }

describe('the options of the engine in Vue', () => {
  it('takes hasColorFallbacks and registered through createStyle', () => {
    const sheet = createMemorySheet()
    const { engine } = createStyle(theme, {
      prefix: 'v',
      registered: { 'palette.primary': true },
      cache: createCache({ prefix: 'v', hasLayers: false, hasColorFallbacks: false, sheet }),
    })
    engine.css({ background: alpha(engine.refs.palette.primary, 0.5) })
    const css = sheet.rules.join('')
    expect(css).toContain(
      'background:color-mix(in srgb, var(--v-palette-primary) 50%, transparent);'
    )
    expect(css).toContain('@property --v-palette-primary{syntax:"<color>";inherits:true;')
  })

  it('writes a fallback, then the mix, by default', () => {
    const { engine } = createStyle(theme, { prefix: 'v', hasLayers: false })
    const className = engine.css({ background: alpha('#102030', 0.5) })
    expect(engine.cache.getRules(className)[0]).toContain(
      'background:rgba(16, 32, 48, 0.5);background:color-mix('
    )
  })
})
