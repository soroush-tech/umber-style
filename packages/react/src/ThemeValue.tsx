'use client'

import { createContext, createElement, Fragment, useContext, type Context } from 'react'
import { EMPTY_THEME, type Engine } from '@umber-style/core'
import type { ThemeScopeProps } from './types'

/** The wrapper of a nested provider: its element and its class string, which `ThemeScope` repeats. */
export interface ThemeScopeValue {
  readonly as: string
  readonly className: string
}

/**
 * The contexts of one style. `ThemeContext` holds the real theme of the nearest provider (its theme
 * merged over the ones above). `ViewContext` holds its view (references for tokens), which stays the same
 * object while only the values of variables change. `ScopeContext` is undefined with no provider above,
 * null under the outermost provider, which renders no element, and the wrapper of the nearest nested one.
 */
export interface ThemeContexts<T> {
  ThemeContext: Context<T | undefined>
  ViewContext: Context<T | undefined>
  ScopeContext: Context<ThemeScopeValue | null | undefined>
}

/** Makes the contexts of one style: the default style makes them before it has an engine, so that it can export the theme context. */
export function createThemeContexts<T>(): ThemeContexts<T> {
  return {
    ThemeContext: createContext<T | undefined>(undefined),
    ViewContext: createContext<T | undefined>(undefined),
    ScopeContext: createContext<ThemeScopeValue | null | undefined>(undefined),
  }
}

/** What the hooks read where no provider is above: the base theme of the engine, or nothing. */
export type ThemeHolder<T> = Pick<Engine<T>, 'baseTheme' | 'createThemeView'>

/** The hooks of one style, and `ThemeScope`, over its contexts. */
export function createThemeValue<T extends object>(
  holder: ThemeHolder<T>,
  { ThemeContext, ViewContext, ScopeContext }: ThemeContexts<T>
) {
  /** The theme where no provider is above: the base theme, or the empty theme. */
  const readOwnTheme = () => holder.baseTheme ?? (EMPTY_THEME as T)

  /** The real theme of the nearest provider, the base theme, or an empty object. */
  function useTheme(): T {
    return useContext(ThemeContext) ?? readOwnTheme()
  }

  /** The view of the theme that function styles read: of the nearest provider, else of the base theme (or of the empty theme). */
  function useThemeView(): T {
    return useContext(ViewContext) ?? holder.createThemeView(readOwnTheme())
  }

  /** The class string of the wrapper of the nearest nested provider; undefined under the outermost one or none. */
  function useThemeClass(): string | undefined {
    return useContext(ScopeContext)?.className
  }

  /**
   * Renders the wrapper of the nearest nested provider again around its children (the same element and
   * classes), for content that a portal puts somewhere else in the document; under the outermost provider,
   * or none, its children alone.
   */
  function ThemeScope({ children }: ThemeScopeProps) {
    const scope = useContext(ScopeContext)
    if (!scope) return createElement(Fragment, null, children)
    return createElement(scope.as, { className: scope.className }, children)
  }

  return { useTheme, useThemeView, useThemeClass, ThemeScope }
}
