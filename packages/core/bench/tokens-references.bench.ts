// What one operation is, in this file:
//   createTokens   one `createTokens(theme)`: the walk over the theme that makes the references
//                  (`var(--name)` in the shape of the theme) and the declarations.
//   theme view     one `tokens.createView(theme)`: the shape of a real theme with a reference for each
//                  token, which a component's function style receives.
//   declare        one `tokens.declare(theme)`: the variable declarations of a theme.
// The small theme has about 20 tokens, the large one about 280. Nothing here touches a sheet.
import type { BenchConfig } from '@soroush.tech/bench'
import { createLargeTheme, createSmallTheme } from '../../../bench/src/themes'
import { core } from './core'

const small = createSmallTheme()
const large = createLargeTheme()
const smallTokens = core.createTokens(small, { prefix: 'b' })
const largeTokens = core.createTokens(large, { prefix: 'b' })

export default {
  name: 'core: tokens and references',
  cases: {
    'createTokens: small theme': () => core.createTokens(small, { prefix: 'b' }),
    'createTokens: large theme': () => core.createTokens(large, { prefix: 'b' }),
    'theme view: small theme': () => smallTokens.createView(small),
    'theme view: large theme': () => largeTokens.createView(large),
    'declare: small theme': () => smallTokens.declare(small),
    'declare: large theme': () => largeTokens.declare(large),
  },
} satisfies BenchConfig
