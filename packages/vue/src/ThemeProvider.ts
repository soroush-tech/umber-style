import {
  computed,
  defineComponent,
  Fragment,
  h,
  inject,
  provide,
  type ComputedRef,
  type InjectionKey,
  type PropType,
} from 'vue'
import { type ColorScheme, type DeepPartial, type Engine, mergeDeep } from '@umber-style/core'

/** Makes the `ThemeProvider` of an engine: an element with the theme class, which provides the real values below it. */
export function createThemeProvider<T extends object>(
  engine: Engine<T>,
  key: InjectionKey<ComputedRef<T>>
) {
  return defineComponent({
    name: 'ThemeProvider',
    props: {
      theme: { type: Object as PropType<DeepPartial<T>>, required: true },
      colorScheme: { type: String as PropType<ColorScheme>, default: undefined },
      as: { type: String, default: 'div' },
      /** Renders no element and no class: the app puts `themeClass(theme)` on an ancestor, usually `<html>`. */
      isRoot: { type: Boolean, default: false },
    },
    setup(props, { slots }) {
      const outer = inject(key, null)
      provide(
        key,
        computed(() => {
          const base = outer?.value ?? engine.baseTheme
          const theme = props.theme as DeepPartial<T>
          return base === undefined ? (theme as T) : mergeDeep<T>(base, theme)
        })
      )
      // The outermost provider gives the engine its base theme here, in render.
      return () => {
        const theme = props.theme as DeepPartial<T>
        // A root provider renders no element and makes no rule: the app puts the class on an ancestor.
        if (props.isRoot) {
          if (!engine.hasTheme) engine.setTheme(theme as T)
          return h(Fragment, null, slots.default?.())
        }
        const scope = engine.themeClass(theme, props.colorScheme)
        return h(props.as, { class: [scope, engine.scopeClass()] }, slots.default?.())
      }
    },
  })
}
