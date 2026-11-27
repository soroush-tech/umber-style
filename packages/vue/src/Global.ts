import {
  Comment,
  computed,
  defineComponent,
  h,
  inject,
  onUnmounted,
  watch,
  type PropType,
} from 'vue'
import { type Engine, type GlobalInput, type GlobalRules } from '@umber-style/core'
import { createGlobalMarker, EMPTY_THEME } from '@umber-style/core/internal'
import { injectCache } from './CacheProvider'
import type { ThemeKeys } from './ThemeProvider'

/** Writes `sets` into the cache of `engine`, in order, as rules that a component rendered, and returns the function that releases them all. */
function insertSets<T>(engine: Engine<T>, sets: readonly GlobalRules[]): () => void {
  const releases = sets.map((set) => engine.cache.insertGlobal(set, { isRendered: true }))
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
 * document (a server render) nothing unmounts: the rules are written for good, for `extractPageStyles`,
 * and the comment it renders (a component that renders nothing renders a comment) is the marker that
 * names its sets, `<!--<prefix>-global <ids>-->`, so that the CSS of this page holds them and the CSS of
 * another page does not. A hydration does not compare the text of a comment.
 * Under a `CacheProvider` the rules go to the cache it gives, through the engine over that cache, with
 * the view of that engine.
 */
export function createGlobal<T extends object>(
  engine: Engine<T>,
  keys: Pick<ThemeKeys<T>, 'theme' | 'view'>
) {
  return defineComponent({
    name: 'Global',
    props: {
      /** A handle that `globalStyles` made, a style object, a function of the theme, or a list of them, written in the order of the list. */
      styles: { type: [Object, Function, Array] as PropType<GlobalInput<T>>, required: true },
    },
    setup(props) {
      const cache = injectCache()
      const local = cache === undefined ? engine : engine.withCache(cache)
      const outerView = inject(keys.view, null)
      const outerTheme = inject(keys.theme, null)
      const readOwnTheme = () => engine.givenTheme ?? (EMPTY_THEME as T)
      const sets = computed(() => {
        const view =
          local === engine
            ? (outerView?.value ?? engine.createThemeView(readOwnTheme()))
            : local.createThemeView(outerTheme?.value ?? readOwnTheme())
        return local.resolveGlobal(props.styles, view)
      })
      if (typeof document === 'undefined') {
        insertSets(local, sets.value)
        const marker = createGlobalMarker(local.cache.prefix, sets.value)
        return () => (marker ? h(Comment, `${marker.name} ${marker.ids}`) : null)
      }
      const ids = computed(() => sets.value.map(({ id }) => id).join(' '))
      let release = insertSets(local, sets.value)
      watch(ids, () => {
        const previous = release
        release = insertSets(local, sets.value)
        previous()
      })
      onUnmounted(() => release())
      return () => null
    },
  })
}
