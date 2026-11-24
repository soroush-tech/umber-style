// The entry `@umber-style/react-native/animated`: the one module of the package that imports the animation
// library, which throws when it is imported where its native part is not built in. The rest of the binding
// never imports this file; an app turns it on by passing `animated` to `createStyle` or `configure`.
import { createAnimatedComponent, css, cubicBezier, steps } from 'react-native-reanimated'
import { createAnimatedDriver } from './animatedDriver'
import type { AnimatedDriver } from './types'

/**
 * Runs the `animation*` and `transition*` keys of styles on React Native, through react-native-reanimated:
 * `createStyle(theme, { animated })` or `configure({ animated })`.
 */
export const animated: AnimatedDriver = createAnimatedDriver({
  createAnimatedComponent,
  keyframes: css.keyframes,
  cubicBezier,
  steps,
})

export type { AnimatedDriver } from './types'
