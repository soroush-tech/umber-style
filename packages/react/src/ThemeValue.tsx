'use client'

import { createContext, createElement, Fragment, use, useContext, type Context } from 'react'
import { EMPTY_THEME, type Cache, type Engine } from '@umber-style/core'
import { useProvidedCache } from './CacheProvider'
import { getMarksContext, type ThemeScopeValue } from './ProviderScope'
import type { ThemeScopeProps } from './types'

/**
 * The contexts of one style. `ThemeContext` holds the real theme of the nearest provider (its theme
 * merged over the ones above). `ViewContext` holds its view (references for tokens), which stays the same
 * object while only the values of variables change. Which provider is above, and its wrapper, are in the
 * marks that both builds share (`ProviderScope`).
 */
export interface ThemeContexts<T> {
  ThemeContext: Context<T | undefined>
  ViewContext: Context<T | undefined>
}

/** Makes the contexts of one style: the default style makes them before it has an engine, so that it can export the theme context. */
export function createThemeContexts<T>(): ThemeContexts<T> {
  return {
    ThemeContext: createContext<T | undefined>(undefined),
    ViewContext: createContext<T | undefined>(undefined),
  }
}

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

/** What the hooks read where no provider is above: the base theme of the engine, or nothing. */
export type ThemeHolder<T> = Pick<
  Engine<T>,
  'cache' | 'baseTheme' | 'createThemeView' | 'withCache'
>

/** The hooks of one style, and `ThemeScope`, over its contexts. */
export function createThemeValue<T extends object>(
  holder: ThemeHolder<T>,
  { ThemeContext, ViewContext }: ThemeContexts<T>
) {
  /** The theme where no provider is above: the base theme, or the empty theme. */
  const readOwnTheme = () => holder.baseTheme ?? (EMPTY_THEME as T)

  /** The real theme of the nearest provider, the base theme, or an empty object. */
  function useTheme(): T {
    return useContext(ThemeContext) ?? readOwnTheme()
  }

  /**
   * The view of the theme that function styles read: of the nearest provider, else of the base theme (or
   * of the empty theme). Under a `CacheProvider` (`cache`, which `useProvidedCache` read) it is the view
   * of the engine over that cache, of the real theme of the nearest provider: its references name the
   * variables of that cache's prefix.
   */
  function useThemeView(cache?: Cache): T {
    const view = useContext(ViewContext)
    const local = cache === undefined ? holder : holder.withCache(cache)
    if (local === holder) return view ?? holder.createThemeView(readOwnTheme())
    return local.createThemeView(use(ThemeContext) ?? readOwnTheme())
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
