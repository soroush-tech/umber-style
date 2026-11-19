import {
  type BindingOptions,
  createLazyEngine,
  type SheetStyles,
  type Theme,
} from '@umber-style/core'
import { defineComponent, h, type ComputedRef } from 'vue'
import { bindEngine } from './createStyle'
import type { Sheet, Style } from './types'

export interface DefaultStyleOptions extends BindingOptions<Theme> {
  /** The base theme, for an app that has no provider at all. */
  theme?: Theme
}

/** Makes the default styling: one engine, made on first use, behind `styled`, `ThemeProvider` and the rest. */
export function createDefaultStyle() {
  let pending: DefaultStyleOptions = {}
  let bound: Style<Theme> | undefined

  const getStyle = (): Style<Theme> => {
    if (!bound) {
      const engine = pending.engine ?? createLazyEngine<Theme>(pending)
      if (pending.theme) engine.setTheme(pending.theme)
      bound = bindEngine(engine)
    }
    return bound
  }

  /** Sets the options of the default engine, and gives it a base theme or an engine to share. Throws once the default style was used. */
  function configure(options: DefaultStyleOptions): void {
    if (bound) throw new Error('configure must be called before the default style is used.')
    pending = options
  }

  const styled: Style<Theme>['styled'] = (tag, options) => getStyle().styled(tag, options)

  const StyleSheet: Style<Theme>['StyleSheet'] = {
    create: (styles) => getStyle().StyleSheet.create(styles),
  }

  function useStyle<S extends SheetStyles>(sheet: Sheet<S>) {
    return getStyle().useStyle(sheet)
  }

  function useTheme(): ComputedRef<Theme> {
    return getStyle().useTheme()
  }

  // A stand-in that renders the real provider, which exists only once the engine does.
  const ThemeProvider = defineComponent({
    name: 'ThemeProvider',
    inheritAttrs: false,
    setup(_props, { attrs, slots }) {
      const Provider = getStyle().ThemeProvider
      return () => h(Provider, attrs as never, slots)
    },
  }) as unknown as Style<Theme>['ThemeProvider']

  return {
    configure,
    getEngine: () => getStyle().engine,
    styled,
    StyleSheet,
    useStyle,
    useTheme,
    ThemeProvider,
    apply: ((...entries) => getStyle().apply(...entries)) as Style<Theme>['apply'],
    themeClass: ((theme, colorScheme) =>
      getStyle().themeClass(theme, colorScheme)) as Style<Theme>['themeClass'],
  }
}
