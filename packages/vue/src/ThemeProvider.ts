import {
  computed,
  defineComponent,
  h,
  inject,
  mergeProps,
  provide,
  watch,
  type ComputedRef,
  type InjectionKey,
  type PropType,
} from 'vue'
import {
  type ColorScheme,
  type DeepPartial,
  EMPTY_THEME,
  type Engine,
  mergeTheme,
  resolveThemeInput,
  type ThemeInput,
} from '@umber-style/core'
import { injectCache } from './CacheProvider'

/** The wrapper of a nested provider: its element and its class string, which `ThemeScope` repeats. */
export interface ThemeScopeValue {
  /** The element of the wrapper. */
  readonly as: string
  /** The class string of the wrapper: its theme class and markers. */
  readonly className: string
}

/**
 * What the providers of one style give below them: the real theme, its view (references for tokens,
 * the same object while only the values of variables change), and the wrapper of the nearest nested
 * provider (null under the outermost provider, which renders no element; nothing with no provider), and
 * the engine of the nearest provider: a provider of another engine (under a `CacheProvider`, the engine of
 * another cache) is the outermost one of its cache.
 */
export interface ThemeKeys<T> {
  /** The real theme of the nearest provider. */
  theme: InjectionKey<ComputedRef<T>>
  /** Its view: references for tokens. */
  view: InjectionKey<ComputedRef<T>>
  /** The wrapper of the nearest nested provider, or null under the outermost one. */
  scope: InjectionKey<ComputedRef<ThemeScopeValue | null>>
  /** The engine of the nearest provider. */
  engine: InjectionKey<Engine<T>>
}

/** Makes the keys of one style. */
export function createThemeKeys<T>(): ThemeKeys<T> {
  return {
    theme: Symbol('theme'),
    view: Symbol('view'),
    scope: Symbol('scope'),
    engine: Symbol('engine'),
  }
}

/**
 * Makes the `ThemeProvider` of an engine. Its theme (or what a function of the theme above returns) is
 * merged over the theme above and provided below it, with its view.
 *
 * - The outermost provider (none above it) renders no element: its theme is declared on `:root`, in
 *   `setup` and again when it changes, which renders no styled component. It gives the engine its base
 *   theme when it has none.
 * - A nested provider renders its wrapper: the theme class of the theme it was given (with the boundary
 *   and scheme markers), the theme class of its merged theme (every variable, for where it is not inside
 *   the wrapper above it), and the scope class, which has `display: contents`.
 * - With `isRoot` it renders no element and makes no rule: the app puts `themeClass(theme)` on an
 *   ancestor, usually `<html>`.
 *
 * Whether a provider is the outermost one, and `isRoot`, are read once, in `setup`. Under a
 * `CacheProvider` it works with the engine over the cache that the provider gives (the same base theme,
 * the prefix of that cache), and is the outermost one when the nearest provider above it has another
 * engine: its theme is declared on `:root` in that cache.
 */
export function createThemeProvider<T extends object>(baseEngine: Engine<T>, keys: ThemeKeys<T>) {
  return defineComponent({
    name: 'ThemeProvider',
    // The attributes go to the wrapper of a nested provider; the outermost one has no element for them.
    inheritAttrs: false,
    props: {
      /** The theme, or the part of it that this subtree changes; or a function of the theme above that returns it. */
      theme: { type: [Object, Function] as PropType<ThemeInput<T>>, required: true },
      colorScheme: { type: String as PropType<ColorScheme>, default: undefined },
      as: { type: String, default: 'div' },
      /** Renders no element, no class and no rule: the app puts `themeClass(theme)` on an ancestor, usually `<html>`. */
      isRoot: { type: Boolean, default: false },
    },
    setup(props, { attrs, slots }) {
      const cache = injectCache()
      const engine = cache === undefined ? baseEngine : baseEngine.withCache(cache)
      const outer = inject(keys.theme, null)
      // The scope of a provider of another engine (another cache) is not this one's: it starts its own.
      const scope = inject(keys.engine, null) === engine ? inject(keys.scope, null) : null
      const isNested = scope !== null && !props.isRoot
      const readOuter = () => outer?.value ?? engine.baseTheme
      const given = computed(() =>
        resolveThemeInput(props.theme as ThemeInput<T>, readOuter() ?? (EMPTY_THEME as T))
      )
      // The first provider gives the engine its base theme, before its children are set up.
      if (!engine.hasTheme) engine.setTheme(given.value as T)
      const merged = computed(() => mergeTheme(readOuter(), given.value))
      const classes = computed(() => {
        const own = engine.themeClass(given.value, props.colorScheme)
        const full = engine.themeId(merged.value as DeepPartial<T>, props.colorScheme)
        const names = [own, own.startsWith(`${full} `) ? '' : full, engine.scopeClass()]
        return names.filter(Boolean).join(' ')
      })
      provide(keys.engine, engine)
      provide(keys.theme, merged)
      provide(
        keys.view,
        computed(() => engine.createThemeView(merged.value))
      )
      provide(
        keys.scope,
        isNested
          ? computed(() => ({ as: props.as, className: classes.value }))
          : (scope ?? computed(() => null))
      )
      if (scope === null && !props.isRoot) {
        const declare = () => engine.declareRoot(merged.value, props.colorScheme)
        declare()
        watch([merged, () => props.colorScheme], declare)
      }
      return () =>
        isNested
          ? h(props.as, mergeProps({ class: classes.value }, attrs), slots.default?.())
          : slots.default?.()
    },
  })
}

/** Makes `ThemeScope` and `useThemeClass` over the keys of one style. */
export function createThemeScope<T>(keys: ThemeKeys<T>) {
  /** The class string of the wrapper of the nearest nested provider, reactive; undefined under the outermost provider, or none. Call it in `setup`. */
  const useThemeClass = (): ComputedRef<string | undefined> => {
    const scope = inject(keys.scope, null)
    return computed(() => scope?.value?.className)
  }

  /** Renders the wrapper of the nearest nested provider again around its slot, for content that a teleport puts elsewhere; under the outermost provider, or none, the slot alone. */
  const ThemeScope = defineComponent({
    name: 'ThemeScope',
    setup(_props, { slots }) {
      const scope = inject(keys.scope, null)
      return () => {
        const value = scope?.value
        return value
          ? h(value.as, { class: value.className }, slots.default?.())
          : slots.default?.()
      }
    },
  })

  return { useThemeClass, ThemeScope }
}
