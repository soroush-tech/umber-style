import {
  type BindingOptions,
  createDeferredObject,
  createDeferredRecord,
  createLazyEngine,
  globalStyles,
  keyframes,
  withTagShorthands,
  type WebStyleObject,
} from '@umber-style/core'
import { defineComponent, h, type Component, type ComputedRef } from 'vue'
import { bindEngine } from './createStyle'
import type { Style, StyledOptions, Theme } from './types'

/** The options of `configure`: the engine options of the core, and the base theme. */
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

  // `styled.div` and the other tags are made on use, through the engine's own `styled`.
  const styled = withTagShorthands(((tag: string | Component, options?: StyledOptions) =>
    getStyle().styled(tag, options)) as Style<Theme>['styled'])

  // An object sheet is made on first read, so a module can create one before `configure` is called.
  const StyleSheet: Style<Theme>['StyleSheet'] = {
    create: ((styles: Record<string, WebStyleObject> | ((theme: Theme) => never)) =>
      typeof styles === 'function'
        ? getStyle().StyleSheet.create(styles)
        : createDeferredRecord(styles, () =>
            getStyle().StyleSheet.create(styles)
          )) as Style<Theme>['StyleSheet']['create'],
  }

  const useStyle = ((sheet: never) => getStyle().useStyle(sheet)) as Style<Theme>['useStyle']

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

  // A stand-in that renders the real ThemeScope, as the provider does.
  const ThemeScope = defineComponent({
    name: 'ThemeScope',
    setup(_props, { slots }) {
      const Real = getStyle().ThemeScope
      return () => h(Real, null, slots)
    },
  }) as unknown as Style<Theme>['ThemeScope']

  function useThemeClass(): ComputedRef<string | undefined> {
    return getStyle().useThemeClass()
  }

  // A stand-in that renders the real Global, as the provider does.
  const Global = defineComponent({
    name: 'Global',
    inheritAttrs: false,
    setup(_props, { attrs }) {
      const Real = getStyle().Global
      return () => h(Real, attrs as never)
    },
  }) as unknown as Style<Theme>['Global']

  return {
    configure,
    getEngine: () => getStyle().engine,
    styled,
    StyleSheet,
    useStyle,
    useTheme,
    ThemeProvider,
    ThemeScope,
    useThemeClass,
    apply: ((...entries) => getStyle().apply(...entries)) as Style<Theme>['apply'],
    // The entry is made on first use, so a module can call it before `configure`.
    css: ((...args: unknown[]) =>
      createDeferredObject(() =>
        (getStyle().css as (...all: unknown[]) => object)(...args)
      )) as Style<Theme>['css'],
    when: ((theme, colorScheme) => getStyle().when(theme, colorScheme)) as Style<Theme>['when'],
    whenScheme: ((scheme) => getStyle().whenScheme(scheme)) as Style<Theme>['whenScheme'],
    themeClass: ((theme, colorScheme) =>
      getStyle().themeClass(theme, colorScheme)) as Style<Theme>['themeClass'],
    // They need no engine, so a module can call them before `configure`.
    keyframes: keyframes as Style<Theme>['keyframes'],
    globalStyles: globalStyles as Style<Theme>['globalStyles'],
    Global,
  }
}
