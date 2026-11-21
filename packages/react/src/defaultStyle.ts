import type { ElementType } from 'react'
import {
  createDeferredObject,
  createDeferredRecord,
  createLazyEngine,
  globalStyles,
  keyframes,
  withTagShorthands,
  type WebStyleObject,
} from '@umber-style/core'
import { bindEngine } from './createStyle'
import { claimPrefixStyle } from './ProviderScope'
import { createThemeContexts } from './ThemeValue'
import type {
  DefaultStyleOptions,
  GlobalProps,
  Styled,
  StyledOptions,
  Theme,
  ThemeScopeProps,
  WebStyle,
  WebThemeProviderProps,
} from './types'

/** Makes the default styling: one engine, made on first use, behind `styled`, `ThemeProvider` and the rest. */
export function createDefaultStyle() {
  let pending: DefaultStyleOptions = {}
  let bound: WebStyle<Theme> | undefined
  // The contexts exist before the engine, so that the theme context can be exported.
  const contexts = createThemeContexts<Theme>()

  const getStyle = (): WebStyle<Theme> => {
    if (!bound) {
      const engine = pending.engine ?? createLazyEngine<Theme>(pending)
      if (pending.theme) engine.setTheme(pending.theme)
      bound = bindEngine(engine, pending, contexts)
    }
    return bound
  }

  // The contexts are those of the prefix it will have, for a provider of the server build of that prefix,
  // which may render before the style is first used: the prefix and the base theme are read from the
  // options until then.
  claimPrefixStyle(
    () =>
      bound?.cache.prefix ??
      pending.engine?.cache.prefix ??
      pending.cache?.prefix ??
      pending.prefix ??
      'css',
    {
      contexts: contexts as never,
      holder: {
        get baseTheme() {
          return bound?.engine.baseTheme ?? pending.theme ?? pending.engine?.baseTheme
        },
      },
    }
  )

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
  const StyleSheet: WebStyle<Theme>['StyleSheet'] = {
    create: ((styles: Record<string, WebStyleObject> | ((theme: Theme) => never)) =>
      typeof styles === 'function'
        ? getStyle().StyleSheet.create(styles)
        : createDeferredRecord(styles, () =>
            getStyle().StyleSheet.create(styles)
          )) as WebStyle<Theme>['StyleSheet']['create'],
  }

  const useStyle = ((sheet: never) => getStyle().useStyle(sheet)) as WebStyle<Theme>['useStyle']

  function useTheme(): Theme {
    return getStyle().useTheme()
  }

  function ThemeProvider(props: WebThemeProviderProps<Theme>) {
    return getStyle().ThemeProvider(props)
  }

  function Global(props: GlobalProps<Theme>) {
    return getStyle().Global(props)
  }

  function ThemeScope(props: ThemeScopeProps) {
    return getStyle().ThemeScope(props)
  }

  function useThemeClass(): string | undefined {
    return getStyle().useThemeClass()
  }

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
    ThemeContext: contexts.ThemeContext,
    apply: ((...entries) => getStyle().apply(...entries)) as WebStyle<Theme>['apply'],
    // The entry is made on first use, so a module can call it before `configure`.
    css: ((...args: unknown[]) =>
      createDeferredObject(() =>
        (getStyle().css as (...all: unknown[]) => object)(...args)
      )) as WebStyle<Theme>['css'],
    when: ((theme, colorScheme) => getStyle().when(theme, colorScheme)) as WebStyle<Theme>['when'],
    whenScheme: ((scheme) => getStyle().whenScheme(scheme)) as WebStyle<Theme>['whenScheme'],
    themeClass: ((theme, colorScheme) =>
      getStyle().themeClass(theme, colorScheme)) as WebStyle<Theme>['themeClass'],
    // They need no engine, so a module can call them before `configure`.
    keyframes: keyframes as WebStyle<Theme>['keyframes'],
    globalStyles: globalStyles as WebStyle<Theme>['globalStyles'],
    Global,
  }
}
