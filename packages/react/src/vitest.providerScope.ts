// What the browser part of a provider of the server build renders, for the tests of the server build. There
// `ProviderScope` is a reference to a client component (see `vitest.clientReferences.ts`), which
// `resolveTree` leaves as an element with its props: this plays it from those props, with the functions
// of the real module, in a full render (every provider above is in the tree).
import type * as Scope from './ProviderScope'
import type { ResolvedElement, ResolvedNode } from './vitest.resolveTree'

const { createNestedStyles, createRootStyle } =
  await vi.importActual<typeof Scope>('./ProviderScope')

/** Whether `node` is the element of the reference to `ProviderScope`. */
const isScope = (node: ResolvedElement) =>
  (node.type as unknown as { $$id?: string }).$$id === 'ProviderScope'

/** The style elements, the wrapper and the children that each `ProviderScope` in `nodes` renders, with `above` the prefixes of the providers above. */
export function playScopes(
  nodes: readonly ResolvedNode[],
  above: ReadonlySet<string> = new Set()
): ResolvedNode[] {
  return nodes.flatMap((node): ResolvedNode[] => {
    if (typeof node === 'string') return [node]
    if (!isScope(node)) return [{ ...node, children: playScopes(node.children, above) }]
    const { prefix, theme } = node.props as unknown as Scope.ProviderScopeProps
    const children = playScopes(node.children, new Set([...above, prefix]))
    if (theme === undefined) return children
    const isNested = above.has(prefix) || (!theme.isWhole && theme.base === undefined)
    const root = createRootStyle(prefix, theme)
    const styles = isNested ? createNestedStyles(prefix, theme) : root ? [root.style] : []
    const elements = styles.map(({ href, text }): ResolvedNode => ({
      type: 'style',
      props: { href, precedence: prefix },
      children: [text],
    }))
    if (!isNested) return [...elements, ...children]
    return [...elements, { type: theme.as, props: { className: theme.className }, children }]
  })
}
