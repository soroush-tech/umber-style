// What one operation is, in this file: one `alpha(color, 0.5)` with the colour in the case name. "Token"
// means a `var(--name)` reference, which the helper can only write as a `color-mix()` for the browser to
// compute; a literal colour it can compute itself. There is no cache and no state.
import type { BenchConfig } from '@soroush.tech/bench'
import { core } from './core'

const { alpha } = core
const color = 'var(--b-palette-primary)'

export default {
  name: 'core: alpha',
  cases: {
    'alpha: token': () => alpha(color, 0.5),
    'alpha: literal hex colour': () => alpha('#1b5fd1', 0.5),
    'alpha: literal named colour': () => alpha('rebeccapurple', 0.5),
  },
} satisfies BenchConfig
