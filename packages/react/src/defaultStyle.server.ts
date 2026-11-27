import type { ElementType } from 'react'
import { createLazyEngine, globalStyles, keyframes, type WebStyleObject } from '@umber-style/core'
import {
  createDeferredObject,
  createDeferredRecord,
  withTagShorthands,
} from '@umber-style/core/internal'
import { bindEngine } from './createStyle.server'
import type {
  DefaultStyleOptions,
  GlobalProps,
  ServerStyle,
  Styled,
  StyledOptions,
  Theme,
  WebThemeProviderProps,
} from './types'

/** Makes the default styling for server components: one engine, made on first use. */
export function createDefaultStyle() {
  let pending: DefaultStyleOptions = {}
  let bound: ServerStyle<Theme> | undefined

  const getStyle = (): ServerStyle<Theme> => {
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

  // `styled.div` and the other tags are made on use, through the engine's own `styled`, when the
  // styles are given: reading them (`Object.assign(wrapper, styled)` reads every tag) leaves `configure`
  // open.
  const styled = withTagShorthands(
    ((tag: ElementType, options?: StyledOptions) =>
      (...args: unknown[]) =>
        (getStyle().styled(tag, options) as (...styles: unknown[]) => unknown)(
          ...args
        )) as unknown as Styled<Theme>
  )

  // An object sheet is made on first read, so a module can create one before `configure` is called.
  const StyleSheet: ServerStyle<Theme>['StyleSheet'] = {
    create: ((styles: Record<string, WebStyleObject> | ((theme: Theme) => never)) =>
      typeof styles === 'function'
        ? getStyle().StyleSheet.create(styles)
        : createDeferredRecord(styles, () =>
            getStyle().StyleSheet.create(styles)
          )) as ServerStyle<Theme>['StyleSheet']['create'],
  }

  const useStyle = ((sheet: never) => getStyle().useStyle(sheet)) as ServerStyle<Theme>['useStyle']

  const useStyleValue: ServerStyle<Theme>['useStyleValue'] = (initial, unit) =>
    getStyle().useStyleValue(initial, unit)

  function useTheme(): Theme {
    return getStyle().useTheme()
  }

  function ThemeProvider(props: WebThemeProviderProps<Theme>) {
    return getStyle().ThemeProvider(props)
  }

  function Global(props: GlobalProps<Theme>) {
    return getStyle().Global(props)
  }

  return {
    configure,
    getEngine: () => getStyle().engine,
    styled,
    StyleSheet,
    useStyle,
    useStyleValue,
    useTheme,
    readTheme: useTheme,
    ThemeProvider,
    apply: ((...entries) => getStyle().apply(...entries)) as ServerStyle<Theme>['apply'],
    // The entry is made on first use, so a module can call it before `configure`.
    css: ((...args: unknown[]) =>
      createDeferredObject(() =>
        (getStyle().css as (...all: unknown[]) => object)(...args)
      )) as ServerStyle<Theme>['css'],
    when: ((theme, colorScheme) =>
      getStyle().when(theme, colorScheme)) as ServerStyle<Theme>['when'],
    whenScheme: ((scheme) => getStyle().whenScheme(scheme)) as ServerStyle<Theme>['whenScheme'],
    themeClass: ((theme, colorScheme) =>
      getStyle().themeClass(theme, colorScheme)) as ServerStyle<Theme>['themeClass'],
    // They need no engine, so a module can call them before `configure`.
    keyframes: keyframes as ServerStyle<Theme>['keyframes'],
    globalStyles: globalStyles as ServerStyle<Theme>['globalStyles'],
    Global,
  }
}
