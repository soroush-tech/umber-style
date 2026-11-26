import { createThemeGuard } from '@umber-style/core/internal'
import { isDevelopment } from './warnStyle'

/** What the errors of the development guard start with, as the warnings of the binding do. */
const HEAD = '@umber-style/react-native: '

const guard = createThemeGuard(HEAD)

/**
 * `theme` as a function of app code named `label` gets it: in development wrapped so that a write at any
 * level throws, naming the path and the label (the same wrapper for the same object and label); else
 * `theme` itself.
 */
export function guardTheme<V extends object>(theme: V, label: string): V {
  return isDevelopment() ? guard(theme, label) : theme
}

/**
 * In development, what the error of a write into the frozen argument of a style function of the
 * component `name` names it by (`callCheckedStyle`); undefined otherwise, where nothing is checked.
 */
export function readStyleOwner(name: string | undefined): string | undefined {
  if (!isDevelopment()) return undefined
  return `${HEAD}A style function${name ? ` of "${name}"` : ''}`
}
