import { createElement, Fragment, type ReactElement } from 'react'
import {
  hashString,
  resolveThemeInput,
  type DeepPartial,
  type Engine,
  type ThemeText,
} from '@umber-style/core'
import { ProviderScope, type ScopeTheme, type SentTheme } from './ProviderScope'
import type { ServerOnlyContext } from './serverContext'
import { collectStyleTexts, createStampElement, createStyleElements } from './styleElements'
import type { WebThemeProviderProps } from './types'

/** What the provider of the server build reads of the request: its slots, and the root theme. */
export interface ServerProviderParts<T> {
  root: ServerOnlyContext<DeepPartial<T> | undefined>
  stamp: ServerOnlyContext<boolean>
  /** The root theme of the request merged over the base theme (the base theme, or an empty object, before a provider gave one). */
  readTheme(): T
}

/**
 * Makes the `ThemeProvider` for server components. It does not give the theme to client components: a
 * theme holds functions, which cannot cross to them. A client component that calls `useTheme()` needs a
 * `ThemeProvider` imported in a client file.
 *
 * A server component has no context, and a server render of a part of the page (a client-side navigation
 * renders only the segment that changed) does not render the providers of the layouts above, so the
 * server cannot tell whether a provider of the same engine is above this one. It does not decide: it
 * renders `ProviderScope`, a client component, with what either outcome needs, and that decides in the
 * tree as it is rendered, on the server for the first HTML and in the browser after a navigation. The
 * declarations of the theme are sent once: those of the given theme, and, from the first provider of a
 * request only, the base theme under them for the root rule when the given theme does not declare all of
 * it (one object for each base theme, which a payload holds once).
 *
 * The first provider that renders in a request gives the root theme of the request, which `readTheme`
 * and function styles read, and a function theme is called with it. With `isRoot` it makes no rule: it
 * sends the style of the theme classes that the app already made for its theme with `themeClass`, the
 * class it put on an ancestor, and renders `ProviderScope` with no theme, which marks its engine for the
 * providers below. The first provider of a request also renders the stamp of the cache options (a
 * `<meta>`), once.
 */
export function createThemeProvider<T extends object>(
  engine: Engine<T>,
  { root, stamp, readTheme }: ServerProviderParts<T>
) {
  // The base theme as sent, one object for each base theme, and whether the text of a theme declares all of it.
  let sentBase: { text: ThemeText; sent: SentTheme } | undefined
  const wholes = new WeakMap<ThemeText, boolean>()

  /** The base theme, as one object for each base theme, which a payload holds once however many providers name it. */
  const readBase = (): SentTheme => {
    const text = engine.readThemeText(engine.baseTheme as DeepPartial<T>)
    if (sentBase?.text !== text) {
      sentBase = { text, sent: { declarations: text.declarations, properties: text.properties } }
    }
    return sentBase.sent
  }

  /** Whether `own` declares every variable of the base theme. */
  const isWhole = (own: ThemeText): boolean => {
    let whole = wholes.get(own)
    if (whole === undefined) {
      const names = new Set(own.names)
      whole = engine
        .readThemeText(engine.baseTheme as DeepPartial<T>)
        .names.every((name) => names.has(name))
      wholes.set(own, whole)
    }
    return whole
  }

  /**
   * What `ProviderScope` needs of the theme `given` to render either outcome. The base theme goes under a
   * theme that does not declare all of it, for its root rule, only from the first provider of a request:
   * one that renders after another one in the same request is below it or beside it, and is not the
   * outermost one of the page.
   */
  const describe = (
    given: DeepPartial<T>,
    { colorScheme, className, as = 'div' }: WebThemeProviderProps<T>,
    isFirst: boolean
  ): ScopeTheme => {
    const { cache } = engine
    const classes = engine.themeClass(given, colorScheme)
    const text = engine.readThemeText(given)
    const own = {
      declarations: text.declarations + (colorScheme ? `color-scheme:${colorScheme};` : ''),
      properties: text.properties,
    }
    const whole = isWhole(text)
    const base = whole || !isFirst ? undefined : readBase()
    const others = [engine.scopeClass(), className].filter(Boolean).join(' ')
    return {
      as,
      className: [classes, others].join(' '),
      classId: engine.themeId(given, colorScheme),
      rootId: `${cache.prefix}-root-${hashString((base?.declarations ?? '') + own.declarations)}`,
      layerOrder: cache.layerOrder,
      own,
      isWhole: whole,
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
    const key = [props.colorScheme, props.className, props.as, isFirst].join('|')
    const known = described.get(given) ?? new Map()
    described.set(given, known)
    let made = known.get(key)
    if (made?.base !== engine.baseTheme) {
      made = { base: engine.baseTheme, theme: describe(given, props, isFirst) }
      known.set(key, made)
    }
    return made.theme
  }

  return function ThemeProvider(props: WebThemeProviderProps<T>): ReactElement {
    const { theme, isRoot, children } = props
    const isFirst = !root.slot().isSet
    const given = resolveThemeInput(theme, readTheme())
    const provided = createElement(root.Provider, { value: given }, children)
    // One stamp for the request, from the first provider that renders.
    const slot = stamp.slot()
    const stamped = slot.isSet ? [] : [createStampElement(engine.cache)]
    slot.isSet = true
    if (!engine.hasTheme) engine.setTheme(given as T)
    const prefix = engine.cache.prefix
    // A root provider renders no element: the app puts the class on an ancestor, and the rules it made are sent.
    if (isRoot) {
      const made = createStyleElements(engine.cache, engine.findThemeIds(given).join(' '))
      const scope = createElement(ProviderScope, { prefix, children: provided })
      return createElement(Fragment, null, ...stamped, ...made, scope)
    }
    const scope = createElement(ProviderScope, {
      prefix,
      theme: readDescription(given, props, isFirst),
      children: provided,
    })
    return createElement(Fragment, null, ...stamped, scope)
  }
}
