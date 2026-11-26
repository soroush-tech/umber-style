'use client'

import { createElement, Fragment, use, useContext } from 'react'
import { EMPTY_THEME, type Cache, type Engine } from '@umber-style/core'
import { useProvidedCache } from './CacheProvider'
import {
  completeTheme,
  getMarksContext,
  type ThemeContexts,
  type ThemeScopeValue,
} from './ProviderScope'
import type { ThemeScopeProps } from './types'

// The contexts of a style are shared by every style of its prefix, and by the browser part of a provider
// of the server build (`ProviderScope`). Which provider is above, and its wrapper, are in the marks that
// both builds share.
export { createThemeContexts, type ThemeContexts } from './ProviderScope'

/**
 * The key of the marks for `engine` under the cache that a `CacheProvider` gives (`cache`): the prefix of
 * the engine's cache, which a provider of the server build marks too, or the given cache when it is
 * another one.
 */
export function readMarkKey(
  engine: Pick<Engine<unknown>, 'cache'>,
  cache: Cache | undefined
): unknown {
  return cache === undefined || cache === engine.cache ? engine.cache.prefix : cache
}

/** What the hooks read where no provider is above: the base theme given to the engine, or nothing. */
export type ThemeHolder<T> = Pick<
  Engine<T>,
  'cache' | 'givenTheme' | 'createThemeView' | 'withCache'
>

/** The hooks of one style, and `ThemeScope`, over its contexts. */
export function createThemeValue<T extends object>(
  holder: ThemeHolder<T>,
  { ThemeContext, ViewContext }: ThemeContexts<T>
) {
  /**
   * The theme where no provider is above: the base theme given on purpose, or the empty theme. A theme
   * that a provider gave the engine (`adoptTheme`) is not it: it would outlive that provider.
   */
  const readOwnTheme = () => holder.givenTheme ?? (EMPTY_THEME as T)

  /** The real theme of the nearest provider, the given base theme, or an empty object. */
  function useTheme(): T {
    return completeTheme(useContext(ThemeContext), holder.givenTheme) ?? readOwnTheme()
  }

  /**
   * The view of the theme that function styles read: of the nearest provider, else of the base theme (or
   * of the empty theme). It is the view that a provider of the client build gives; below a provider of the
   * server build, which gives none, and under a `CacheProvider` (`cache`, which `useProvidedCache` read),
   * it is made from the real theme of the nearest provider, by the engine over that cache: its references
   * name the variables of that cache's prefix. The theme context is read only then, so that a component
   * that reads a view given renders again only when the view changes.
   */
  function useThemeView(cache?: Cache): T {
    const view = useContext(ViewContext)
    const local = cache === undefined ? holder : holder.withCache(cache)
    if (local === holder && view !== undefined) return view
    return local.createThemeView(
      completeTheme(use(ThemeContext), holder.givenTheme) ?? readOwnTheme()
    )
  }

  /** The wrapper of the nearest nested provider of either build: null under the outermost one, undefined with none. */
  function useScope(): ThemeScopeValue | null | undefined {
    const marks = use(getMarksContext())
    return marks.get(readMarkKey(holder, useProvidedCache()))?.scope
  }

  /** The class string of the wrapper of the nearest nested provider; undefined under the outermost one or none. */
  function useThemeClass(): string | undefined {
    return useScope()?.className
  }

  /**
   * Renders the wrapper of the nearest nested provider again around its children (the same element and
   * classes), for content that a portal puts somewhere else in the document; under the outermost provider,
   * or none, its children alone.
   */
  function ThemeScope({ children }: ThemeScopeProps) {
    const scope = useScope()
    if (!scope) return createElement(Fragment, null, children)
    return createElement(scope.as, { className: scope.className }, children)
  }

  return { useTheme, useThemeView, useThemeClass, ThemeScope }
}
