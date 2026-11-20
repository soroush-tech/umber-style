'use client'

// A namespace import: the server build of React has no hooks and no `createContext`, and a server that
// loads the server build of this package with no bundler (which would make this module a reference)
// still loads this module. So nothing here calls React when the module loads.
import * as React from 'react'
import { createThemeRule, ROOT_SELECTOR } from '@umber-style/core'
import type { StyleText } from './styleElements'

/** The wrapper of a nested provider: its element and its class string, which `ThemeScope` repeats. */
export interface ThemeScopeValue {
  readonly as: string
  readonly className: string
}

/** What a provider tells the components below it about itself, for its engine. */
export interface ProviderMark {
  /** The wrapper of the nearest nested provider, or null when there is none below the outermost one. */
  readonly scope: ThemeScopeValue | null
  /** Whether a provider of the server build is above: the theme context of the client build lacks its theme. */
  readonly hasServerAbove: boolean
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

/** The variables of a theme as text: `--name:value;` for each (and its color-scheme), and the `@property` rules of the registered ones. */
export interface SentTheme {
  readonly declarations: string
  readonly properties: string
}

/** What a provider of the server build sends of its theme: the browser makes the rule of the outcome it picks. */
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
  /** The given theme. */
  readonly own: SentTheme
  /** Whether the given theme declares every variable of the base theme: its root rule needs no base theme. */
  readonly isWhole: boolean
  /**
   * The base theme, which the root rule declares before `own`, when `own` does not declare all of it and the
   * provider was the first of its request. It is one object for each base theme, which a payload of server
   * components holds once however many providers name it. A provider that has neither can only be nested.
   */
  readonly base?: SentTheme
  /** The style elements of the other classes of the wrapper: the scope class, and the classes in `className`. */
  readonly styles: readonly StyleText[]
}

export interface ProviderScopeProps {
  /** The prefix of the engine's cache: the key of its mark. */
  readonly prefix: string
  /** The theme, and the wrapper; none for a provider with `isRoot`, which renders neither. */
  readonly theme?: ScopeTheme
  readonly children?: React.ReactNode
}

/** The style element of the root rule of `theme` (the base theme, then the given one, on `:root`) and that rule alone; none when it declares nothing. */
export function createRootStyle(
  prefix: string,
  theme: ScopeTheme
): { style: StyleText; rule: string } | undefined {
  const { own, base, layerOrder, rootId } = theme
  const body = (base?.declarations ?? '') + own.declarations
  if (body === '') return undefined
  const rule = createThemeRule(prefix, layerOrder !== '', ROOT_SELECTOR, body)
  const text = layerOrder + (base?.properties ?? '') + own.properties + rule
  return { style: { href: rootId, text }, rule }
}

/** The style elements of a nested provider: of its theme class (none when it declares nothing), then of its other classes. */
export function createNestedStyles(prefix: string, theme: ScopeTheme): readonly StyleText[] {
  const { classId, own, layerOrder, styles } = theme
  if (own.declarations === '') return styles
  const rule = createThemeRule(prefix, layerOrder !== '', `.${classId}`, own.declarations)
  return [{ href: classId, text: layerOrder + own.properties + rule }, ...styles]
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
  const pattern = new RegExp(`^(@layer ${prefix}-theme\\s*\\{\\s*)?:where\\(:root\\)`)
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
 * The browser part of a provider of the server build, which renders it with the data of its theme. Whether
 * a provider of the same engine is above is decided here, in the tree as it is rendered: a server render of
 * a part of the page (a client-side navigation renders only the segment that changed) does not render the
 * providers of the layouts above it, which are mounted in the browser. Rendered on the server as any client
 * component is, it makes the same choice in the first HTML.
 *
 * - Nested: it renders the style element of the theme class of its theme, those of its other classes, and
 *   its wrapper.
 * - Outermost: no element; the style element of its root rule (the base theme, then its theme, on
 *   `:root`), and, once committed in the browser, it leaves that root rule alone in the document. A
 *   provider that has no base theme for that rule (see `ScopeTheme.base`) is nested instead.
 * - With no theme (`isRoot`): nothing but the mark, which passes on the wrapper and the kind of the
 *   provider above.
 *
 * It marks its prefix for the providers below, of both builds.
 */
export function ProviderScope({ prefix, theme, children }: ProviderScopeProps): React.ReactElement {
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
  // it passes on what is above. Otherwise its theme is one that the client context does not hold.
  const scope = theme === undefined ? (above?.scope ?? null) : (wrapper ?? null)
  const hasServerAbove = theme === undefined ? (above?.hasServerAbove ?? false) : true
  const below = React.useMemo(
    () => addMark(marks, prefix, { scope, hasServerAbove }),
    [marks, prefix, scope, hasServerAbove]
  )
  const root = React.useMemo(
    () => (theme === undefined || isNested ? undefined : createRootStyle(prefix, theme)),
    [prefix, theme, isNested]
  )
  const rootRule = root?.rule
  const rootId = theme?.rootId
  React.useLayoutEffect(() => {
    if (rootRule !== undefined) keepRootRule(prefix, rootId as string, rootRule, document)
  }, [prefix, rootId, rootRule])

  let styles: readonly StyleText[] = root === undefined ? [] : [root.style]
  if (wrapper !== undefined) styles = createNestedStyles(prefix, theme as ScopeTheme)
  const content = React.createElement(MarksContext.Provider, { value: below }, children)
  return React.createElement(
    React.Fragment,
    null,
    styles.map(({ href, text }) =>
      React.createElement('style', { key: href, href, precedence: prefix }, text)
    ),
    wrapper === undefined
      ? content
      : React.createElement(wrapper.as, { className: wrapper.className }, content)
  )
}
