// A stand-in for react-native-reanimated, which Node cannot load: the built animated entry's import of it
// is sent here (`prepareBuiltPackages` in `fixtures.ts`). It has the four functions the entry calls, as the
// library's official mock has them: `createAnimatedComponent` returns the component itself, and
// `css.keyframes`, `cubicBezier` and `steps` return plain objects of what they were given. What the
// library does with a style on a device (its normalization, the native side) is not here.

/** The animated form of `component`: the component itself, as in the library's mock. */
export function createAnimatedComponent<C>(component: C): C {
  return component
}

let count = 0

export const css = {
  /** A rule of steps with a name of its own, as the library makes one. */
  keyframes: (steps: object) => ({ cssRules: steps, name: `REA-CSS-${count++}` }),
}

/** The easing object of a curve. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  return { x1, y1, x2, y2 }
}

/** The easing object of steps. */
export function steps(stepsNumber: number, modifier: string) {
  return { stepsNumber, modifier }
}
