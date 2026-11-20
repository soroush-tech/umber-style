import {
  computed,
  defineComponent,
  inject,
  onUnmounted,
  watch,
  type ComputedRef,
  type InjectionKey,
  type PropType,
} from 'vue'
import { EMPTY_THEME, type Engine, type GlobalInput, type GlobalRules } from '@umber-style/core'

/** Writes `sets` into the cache of `engine`, in order, and returns the function that releases them all. */
function insertSets<T>(engine: Engine<T>, sets: readonly GlobalRules[]): () => void {
  const releases = sets.map((set) => engine.cache.insertGlobal(set))
  return () => {
    for (const release of releases) release()
  }
}

/**
 * Makes the `Global` of an engine: it renders nothing, and writes the rules of its styles with the view
 * of the theme of the nearest provider (references for tokens, real values for raw keys), or of the base
 * theme (or an empty one) with none. In the browser they are
 * written in `setup`, before it mounts, and released when it unmounts; when the rules change (its styles,
 * or what they read of the theme) the new ones are written first and then the old ones released, so that
 * there is no moment with neither. The cache counts the rules of each set, so two components with equal
 * styles share them, and rules that a server render left in the page are taken over. Where there is no
 * document (a server render) nothing unmounts: the rules are written for good, for `extractPageStyles`.
 */
export function createGlobal<T extends object>(
  engine: Engine<T>,
  viewKey: InjectionKey<ComputedRef<T>>
) {
  return defineComponent({
    name: 'Global',
    props: {
      /** A handle that `globalStyles` made, a style object, a function of the theme, or a list of them, written in the order of the list. */
      styles: { type: [Object, Function, Array] as PropType<GlobalInput<T>>, required: true },
    },
    setup(props) {
      const outer = inject(viewKey, null)
      const sets = computed(() => {
        const view = outer?.value ?? engine.createThemeView(engine.baseTheme ?? (EMPTY_THEME as T))
        return engine.resolveGlobal(props.styles, view)
      })
      if (typeof document === 'undefined') {
        insertSets(engine, sets.value)
        return () => null
      }
      const ids = computed(() => sets.value.map(({ id }) => id).join(' '))
      let release = insertSets(engine, sets.value)
      watch(ids, () => {
        const previous = release
        release = insertSets(engine, sets.value)
        previous()
      })
      onUnmounted(() => release())
      return () => null
    },
  })
}
