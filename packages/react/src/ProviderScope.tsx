'use client'

// A namespace import: the server build of React has no hooks and no `createContext`, and a server that
// loads the server build of this package with no bundler (which would make this module a reference)
// still loads this module. So nothing here calls React when the module loads.
import * as React from 'react'
import {
  createThemeRule,
  createTokens,
  mergeTheme,
  ROOT_SELECTOR,
  toDeclarationText,
  type ColorScheme,
  type TokenOptions,
} from '@umber-style/core'
import type { StyleText } from './styleElements'

/** The wrapper of a nested provider: its element and its class string, which `ThemeScope` repeats. */
export interface ThemeScopeValue {
  /** The element of the wrapper. */
  readonly as: string
  /** The classes of the wrapper. */
  readonly className: string
}

/** What a provider tells the components below it about itself, for its engine. */
export interface ProviderMark {
  /** The wrapper of the nearest nested provider, or null when there is none below the outermost one. */
  readonly scope: ThemeScopeValue | null
}

/**
 * The nearest provider above, for each engine: the key is the prefix of the engine's cache, or the cache
 * that a `CacheProvider` gives when it is another one. A key that is absent has no provider above. Both
 * builds write it: the provider of the client build, and the browser part of a provider of the server build.
 */
export type ProviderMarks = ReadonlyMap<unknown, ProviderMark>

const NO_MARKS: ProviderMarks = new Map()
let marksContext: React.Context<ProviderMarks> | undefined

/** The context of the marks, made on first use: where this module is loaded with the server build of React, nothing renders it. */
export function getMarksContext(): React.Context<ProviderMarks> {
  marksContext ??= React.createContext(NO_MARKS)
  return marksContext
}

/** `marks`, with `mark` as the nearest provider of `key`. */
export function addMark(marks: ProviderMarks, key: unknown, mark: ProviderMark): ProviderMarks {
  return new Map(marks).set(key, mark)
}

/**
 * The contexts of one prefix. `ThemeContext` holds the real theme of the nearest provider (its theme
 * merged over the ones above), of either build. `ViewContext` holds its view (references for tokens),
 * which stays the same object while only the values of variables change; a provider of the server build
 * sets it to undefined, and what reads it below makes the view of `ThemeContext`.
 */
export interface ThemeContexts<T> {
  /** The real theme of the nearest provider. */
  ThemeContext: React.Context<T | undefined>
  /** The view of the nearest provider (references for tokens), or undefined where a provider of the server build is nearest. */
  ViewContext: React.Context<T | undefined>
}

/** Makes the contexts of one style. */
export function createThemeContexts<T>(): ThemeContexts<T> {
  return {
    ThemeContext: React.createContext<T | undefined>(undefined),
    ViewContext: React.createContext<T | undefined>(undefined),
  }
}

/** The styles of the client build of one prefix: the contexts they share, and the engine whose base theme a provider of the server build merges over. */
export interface PrefixStyle {
  /** The contexts that every style of the prefix reads and its providers give. */
  readonly contexts: ThemeContexts<unknown>
  /** What holds the base theme of the engine, once a style of the client build has one; undefined before. */
  holder?: { readonly baseTheme: unknown }
}

const prefixStyles = new Map<string, PrefixStyle>()
let claim: { readPrefix(): string; style: PrefixStyle } | undefined

/**
 * The default style's claim on a prefix: its contexts exist before its engine and its prefix, which
 * `readPrefix` gives on demand. The prefix is the one it will have when its options are set.
 */
export function claimPrefixStyle(readPrefix: () => string, style: PrefixStyle): void {
  claim = { readPrefix, style }
}

/**
 * The styles of `prefix`, recorded on first use: the default style's when it claims that prefix, else
 * new contexts. Every style of one prefix (the default one, each `createStyle`) shares them, as they
 * share its marks, and so does the browser part of a provider of the server build, which needs no engine.
 */
export function readPrefixStyle(prefix: string): PrefixStyle {
  let style = prefixStyles.get(prefix)
  if (style === undefined) {
    style = claim?.readPrefix() === prefix ? claim.style : { contexts: createThemeContexts() }
    prefixStyles.set(prefix, style)
  }
  return style
}

/** The token options that name the variables of a theme, as plain data; the prefix is that of the provider. */
export type SentTokens = Pick<TokenOptions, 'rawKeys' | 'lengthKeys' | 'modes'>

/** The base theme as a provider of the server build sends it: plain data, and the `@property` rules of its registered variables. */
export interface ScopeBase {
  /** The base theme, as plain data. */
  readonly theme: object
  /** The `@property` rules of the registered variables of the base theme, or ''. */
  readonly properties: string
}

/** What a provider of the server build sends of its rules, besides the theme it was given: the browser makes the rule of the outcome it picks. */
export interface ScopeTheme {
  /** The element of the wrapper. */
  readonly as: string
  /** The classes of the wrapper: the theme class, the boundary and scheme markers, the scope class, `className`. */
  readonly className: string
  /** The theme class of the given theme: the class, and the `href` of its rule when the provider is nested. */
  readonly classId: string
  /** The `href` of the root rule, when it is the outermost provider. */
  readonly rootId: string
  /** The order statement of the layers of the cache, or '' without layers. */
  readonly layerOrder: string
  /** The color scheme that the rule of the given theme sets. */
  readonly colorScheme?: ColorScheme
  /** The token options of the engine: one object for each engine, which a payload holds once. */
  readonly tokens: SentTokens
  /** The `@property` rules of the registered variables of the given theme, or ''. */
  readonly properties: string
  /** Whether the given theme declares every variable of the base theme: its root rule needs no base theme. */
  readonly isWhole: boolean
  /**
   * The base theme, which the root rule declares before the given theme, when that one does not declare
   * all of it and the provider was the first of its request. It is one object for each base theme, which a
   * payload of server components holds once however many providers name it. A provider that has neither
   * can only be nested.
   */
  readonly base?: ScopeBase
  /** The style elements of the other classes of the wrapper: the scope class, and the classes in `className`. */
  readonly styles: readonly StyleText[]
}

/** The props of `ProviderScope`: what a provider of the server build hands to its browser part. */
export interface ProviderScopeProps {
  /** The prefix of the engine's cache: the key of its mark, and of its contexts. */
  readonly prefix: string
  /** The theme the provider was given (after a function theme was called), as plain data. */
  readonly given: object
  /** The rules and the wrapper; none for a provider with `isRoot`, which renders neither. */
  readonly theme?: ScopeTheme
  /** The subtree that the theme applies to. */
  readonly children?: React.ReactNode
}

/** The declarations of the variables of `values`, `--name:value;` for each: the text that the engine's `readThemeText` gives. */
export function declareValues(prefix: string, values: object, tokens: SentTokens): string {
  const declared = createTokens(values, { ...tokens, prefix }).declare(values)
  return toDeclarationText(Object.entries(declared))
}

/** The declarations of the given theme, and its color-scheme. */
function declareOwn(prefix: string, given: object, theme: ScopeTheme): string {
  const { colorScheme, tokens } = theme
  return declareValues(prefix, given, tokens) + (colorScheme ? `color-scheme:${colorScheme};` : '')
}

/** The style element of the root rule (the base theme, then the given one, on `:root`) and that rule alone; none when it declares nothing. */
export function createRootStyle(
  prefix: string,
  given: object,
  theme: ScopeTheme
): { style: StyleText; rule: string } | undefined {
  const { base, layerOrder, rootId, tokens, properties } = theme
  const body =
    (base === undefined ? '' : declareValues(prefix, base.theme, tokens)) +
    declareOwn(prefix, given, theme)
  if (body === '') return undefined
  const rule = createThemeRule(prefix, layerOrder !== '', ROOT_SELECTOR, body)
  const text = layerOrder + (base?.properties ?? '') + properties + rule
  return { style: { href: rootId, text }, rule }
}

/** The style elements of a nested provider: of its theme class (none when it declares nothing), then of its other classes. */
export function createNestedStyles(
  prefix: string,
  given: object,
  theme: ScopeTheme
): readonly StyleText[] {
  const { classId, layerOrder, properties, styles } = theme
  const own = declareOwn(prefix, given, theme)
  if (own === '') return styles
  const rule = createThemeRule(prefix, layerOrder !== '', `.${classId}`, own)
  return [{ href: classId, text: layerOrder + properties + rule }, ...styles]
}

/**
 * Leaves one root rule of `prefix` in the style elements that React keeps for it (`data-precedence`): the
 * one in the element of `rootId`, written again there when an earlier pass deleted it, and none in any
 * other element. React keeps a style element for the life of the document, so after the root theme
 * changed (a refresh that renders another theme, a navigation back) the elements of the earlier ones are
 * still there. Nothing changes until React has put the element of `rootId` in the document. The elements
 * of the browser's cache and of a registry are not touched.
 */
export function keepRootRule(prefix: string, rootId: string, rule: string, page: Document): void {
  const elements = [
    ...page.querySelectorAll<HTMLStyleElement>(`style[data-precedence="${prefix}"]`),
  ]
  const own = elements.find((element) => element.dataset.href?.split(' ').includes(rootId))
  if (own === undefined) return
  const pattern = new RegExp(String.raw`^(@layer ${prefix}-theme\s*\{\s*)?:where\(:root\)`)
  for (const element of elements) {
    const sheet = element.sheet as CSSStyleSheet
    let isKept = element !== own
    for (let index = sheet.cssRules.length - 1; index >= 0; index--) {
      if (!pattern.test(sheet.cssRules[index].cssText)) continue
      if (isKept) sheet.deleteRule(index)
      isKept = true
    }
    if (!isKept) sheet.insertRule(rule, sheet.cssRules.length)
  }
}

/**
 * The browser part of a provider of the server build, which renders it with the theme it was given, as
 * plain data, and the data of its rules. Whether a provider of the same engine is above is decided here,
 * in the tree as it is rendered: a server render of a part of the page (a client-side navigation renders
 * only the segment that changed) does not render the providers of the layouts above it, which are mounted
 * in the browser. Rendered on the server as any client component is, it makes the same choice in the
 * first HTML. The rules are made here from the values, with the core's tokens, so the server and the
 * browser write the same text from the same props, with or without an engine of the client build.
 *
 * - Nested: it renders the style element of the theme class of its theme, those of its other classes, and
 *   its wrapper.
 * - Outermost: no element; the style element of its root rule (the base theme, then its theme, on
 *   `:root`), and, once committed in the browser, it leaves that root rule alone in the document. A
 *   provider that has no base theme for that rule (see `ScopeTheme.base`) is nested instead.
 * - With no rules (`isRoot`): no element, no rule.
 *
 * In each case it marks its prefix for the providers below, of both builds, and gives the contexts of
 * its prefix the theme merged over the theme of the provider above it in the page, of either build, else
 * over the base theme of the client build: `useTheme()` of a client component below reads it.
 */
export function ProviderScope({
  prefix,
  given,
  theme,
  children,
}: ProviderScopeProps): React.ReactElement {
  const MarksContext = getMarksContext()
  const marks = React.use(MarksContext)
  const above = marks.get(prefix)
  // A provider that rendered after another one in its request, with a partial theme, has no base theme
  // for a root rule: where nothing is above it (beside the outermost one), it renders its wrapper too.
  const isNested =
    theme !== undefined && (above !== undefined || (!theme.isWhole && theme.base === undefined))
  // The wrapper stays the same object while its element and classes do, for the marks below.
  const as = theme?.as as string
  const className = theme?.className as string
  const wrapper = React.useMemo(
    (): ThemeScopeValue | undefined => (isNested ? { as, className } : undefined),
    [isNested, as, className]
  )
  // With isRoot the theme is the class on an ancestor, as for a provider of the client build with isRoot:
  // it passes on the wrapper above.
  const scope = theme === undefined ? (above?.scope ?? null) : (wrapper ?? null)
  const below = React.useMemo(() => addMark(marks, prefix, { scope }), [marks, prefix, scope])
  const { contexts, holder } = readPrefixStyle(prefix)
  const outer = (React.use(contexts.ThemeContext) ?? holder?.baseTheme) as object | undefined
  const merged = React.useMemo(() => mergeTheme(outer, given), [outer, given])
  const styles = React.useMemo(() => {
    if (theme === undefined) return { list: [] as readonly StyleText[], rule: undefined }
    if (isNested) return { list: createNestedStyles(prefix, given, theme), rule: undefined }
    const root = createRootStyle(prefix, given, theme)
    return { list: root === undefined ? [] : [root.style], rule: root?.rule }
  }, [prefix, given, theme, isNested])
  const rootRule = styles.rule
  const rootId = theme?.rootId
  React.useLayoutEffect(() => {
    if (rootRule !== undefined) keepRootRule(prefix, rootId as string, rootRule, document)
  }, [prefix, rootId, rootRule])

  const content = React.createElement(
    MarksContext.Provider,
    { value: below },
    React.createElement(
      contexts.ThemeContext.Provider,
      { value: merged },
      React.createElement(contexts.ViewContext.Provider, { value: undefined }, children)
    )
  )
  return React.createElement(
    React.Fragment,
    null,
    styles.list.map(({ href, text }) =>
      React.createElement('style', { key: href, href, precedence: prefix }, text)
    ),
    wrapper === undefined
      ? content
      : React.createElement(wrapper.as, { className: wrapper.className }, content)
  )
}
