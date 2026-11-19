import {
  Fragment,
  isValidElement,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from 'react'

export interface ResolvedElement {
  type: string
  props: Record<string, unknown>
  children: ResolvedNode[]
}

export type ResolvedNode = string | ResolvedElement

/**
 * The tree that `node` renders to, as plain data: function components are called, in order and one
 * after the other, and may be async. It is how server components are rendered where there is no
 * `react-dom/server`, for a test.
 */
export async function resolveTree(node: ReactNode): Promise<ResolvedNode[]> {
  if (Array.isArray(node)) {
    // One promise chain, so that each item starts after the one before it has finished.
    return node.reduce<Promise<ResolvedNode[]>>(
      async (before, item) => [...(await before), ...(await resolveTree(item))],
      Promise.resolve([])
    )
  }
  if (node === null || node === undefined || typeof node === 'boolean') return []
  if (typeof node === 'string' || typeof node === 'number') return [String(node)]
  if (!isValidElement(node)) throw new TypeError('resolveTree needs elements, strings and numbers.')

  const { type, props } = node as ReactElement<Record<string, unknown>, ElementType>
  if (typeof type === 'function') {
    const render = type as (props: unknown) => ReactNode | Promise<ReactNode>
    return resolveTree(await render(props))
  }
  if ((type as unknown) === Fragment) return resolveTree(props.children as ReactNode)
  const { children, ...rest } = props
  return [{ type: type as string, props: rest, children: await resolveTree(children as ReactNode) }]
}

/** Every element of `nodes` (and below) of the type `type`, in document order. */
export function findAll(nodes: readonly ResolvedNode[], type: string): ResolvedElement[] {
  return nodes.flatMap((node) =>
    typeof node === 'string'
      ? []
      : [...(node.type === type ? [node] : []), ...findAll(node.children, type)]
  )
}
