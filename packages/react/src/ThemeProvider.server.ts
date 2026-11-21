import { createElement, Fragment, type ReactElement } from 'react'
import {
  createThemeClassName,
  createThemeId,
  hashString,
  isDevelopment,
  resolveThemeInput,
  type DeepPartial,
  type Engine,
  type ThemeInput,
  type ThemeText,
} from '@umber-style/core'
import { toPlainTheme } from './plainTheme'
import { ProviderScope, type ScopeBase, type ScopeTheme, type SentTokens } from './ProviderScope'
import type { ServerSlot } from './serverContext'
import { collectStyleTexts, createStampElement, createStyleElements } from './styleElements'
import type { WebThemeProviderProps } from './types'

/** What the provider of the server build reads of the request and of the style. */
export interface ServerProviderParts<T> {
  /** The slot of the request: the theme of the first provider that renders in it, and whether one has. */
  readFirstSlot(): ServerSlot<DeepPartial<T> | undefined>
  /** The base theme of the style, or an empty object when it has none. */
  readBaseTheme(): T
}

/**
 * Makes the `ThemeProvider` for server components. A server component has no context, and a server
 * render of a part of the page (a client-side navigation renders only the segment that changed) does not
 * render the providers of the layouts above, so the server cannot tell whether a provider of the same
 * engine is above this one, nor what theme it has. It decides nothing: it renders `ProviderScope`, a
 * client component, with the theme it was given as plain data and what either outcome needs, and that
 * decides in the tree as it is rendered, on the server for the first HTML and in the browser after a
 * navigation. It puts the theme into the theme context of the client build too, merged over the theme
 * of the provider above it in the page, so `useTheme()` of a client component below reads it.
 *
 * The values of the theme are sent once: the rules are made from them in `ProviderScope`. A member that
 * cannot cross to a client component (a function, a symbol, a class instance) is left out, with one
 * warning in development. The first provider of a request also sends the base theme, for the root rule,
 * when the given theme does not declare all of it (one object for each base theme, which a payload holds
 * once), and the stamp of the cache options (a `<meta>`).
 *
 * It never gives the engine a base theme: that comes from `createStyle(theme)` or `configure({ theme })`.
 * A function theme is called with the base theme, in every render. With `isRoot` it makes no rule: it
 * sends the style of the theme classes that the app already made for its theme with `themeClass`, the
 * class it put on an ancestor, and renders `ProviderScope` with no rules.
 */
export function createThemeProvider<T extends object>(
  engine: Engine<T>,
  { readFirstSlot, readBaseTheme }: ServerProviderParts<T>
) {
  const prefix = engine.cache.prefix
  // The token options as plain data, one object for the engine.
  const { rawKeys, lengthKeys, modes } = engine.tokenOptions
  const tokens: SentTokens = {
    ...(rawKeys && { rawKeys }),
    ...(lengthKeys && { lengthKeys }),
    ...(modes && { modes }),
  }
  // The base theme as sent, one object for each base theme.
  let sentBase: { theme: T; sent: ScopeBase } | undefined
  let hasWarned = false

  /** The plain data of `given`, with one warning in development for the first theme that has members left out. */
  const readPlain = (given: DeepPartial<T>): object => {
    const { theme, dropped } = toPlainTheme(given)
    if (dropped.length > 0 && !hasWarned && isDevelopment()) {
      hasWarned = true
      console.warn(
        `[${prefix}] A ThemeProvider of a server component was given a theme with members that cannot cross to a client component: ${dropped.join(', ')}. They are left out of the theme that client components read below it, where these members keep the values of the theme above.`
      )
    }
    return theme
  }

  /** The base theme as sent, for `base`. */
  const readBase = (base: T): ScopeBase => {
    if (sentBase?.theme !== base) {
      const { properties } = engine.readThemeText(base as DeepPartial<T>)
      sentBase = { theme: base, sent: { theme: toPlainTheme(base).theme, properties } }
    }
    return sentBase.sent
  }

  /**
   * What `ProviderScope` needs to render either outcome for the theme `given`. The base theme goes under a
   * theme that does not declare all of it, for its root rule, only from the first provider of a request:
   * one that renders after another one in the same request is below it or beside it, and is not the
   * outermost one of the page.
   */
  const describe = (
    given: DeepPartial<T>,
    { colorScheme, className, as = 'div' }: WebThemeProviderProps<T>,
    isFirst: boolean
  ): ScopeTheme => {
    const { cache, baseTheme } = engine
    const text = engine.readThemeText(given)
    const classId = createThemeId(prefix, text.declarations, colorScheme)
    const own = text.declarations + (colorScheme ? `color-scheme:${colorScheme};` : '')
    const baseText = baseTheme && engine.readThemeText(baseTheme as DeepPartial<T>)
    const names = new Set(text.names)
    // With no base theme there is nothing to declare under it.
    const isWhole = baseText === undefined || baseText.names.every((name) => names.has(name))
    const base = isWhole || !isFirst ? undefined : readBase(baseTheme as T)
    const others = [engine.scopeClass(), className].filter(Boolean).join(' ')
    const rootBody = (base === undefined ? '' : (baseText as ThemeText).declarations) + own
    return {
      as,
      className: [createThemeClassName(prefix, classId, colorScheme), others].join(' '),
      classId,
      rootId: `${prefix}-root-${hashString(rootBody)}`,
      layerOrder: cache.layerOrder,
      ...(colorScheme && { colorScheme }),
      tokens,
      properties: text.properties,
      isWhole,
      ...(base && { base }),
      styles: collectStyleTexts(cache, others),
    }
  }

  // What `describe` made, for each theme object and the props that change it, while the base theme is the same.
  const described = new WeakMap<object, Map<string, { base: T | undefined; theme: ScopeTheme }>>()
  const readDescription = (
    given: DeepPartial<T>,
    props: WebThemeProviderProps<T>,
    isFirst: boolean
  ): ScopeTheme => {
    const { colorScheme, className, as } = props
    const key = [colorScheme, className, as, isFirst].join('|')
    const known = described.get(given) ?? new Map()
    described.set(given, known)
    let made = known.get(key)
    if (made === undefined || made.base !== engine.baseTheme) {
      made = { base: engine.baseTheme, theme: describe(given, props, isFirst) }
      known.set(key, made)
    }
    return made.theme
  }

  return function ThemeProvider(props: WebThemeProviderProps<T>): ReactElement {
    const { theme, isRoot, children } = props
    const given = resolveThemeInput(theme as ThemeInput<T>, readBaseTheme())
    // The first provider of the request sends the stamp, and its theme gives the shape of the view of
    // function styles where the style has no base theme.
    const slot = readFirstSlot()
    const isFirst = !slot.isSet
    if (isFirst) {
      slot.isSet = true
      slot.current = given
    }
    const stamped = isFirst ? [createStampElement(engine.cache)] : []
    const plain = readPlain(given)
    // A root provider renders no element: the app puts the class on an ancestor, and the rules it made are sent.
    if (isRoot) {
      const made = createStyleElements(engine.cache, engine.findThemeIds(given).join(' '))
      const scope = createElement(ProviderScope, { prefix, given: plain }, children)
      return createElement(Fragment, null, ...stamped, ...made, scope)
    }
    const scope = createElement(
      ProviderScope,
      { prefix, given: plain, theme: readDescription(given, props, isFirst) },
      children
    )
    return createElement(Fragment, null, ...stamped, scope)
  }
}
