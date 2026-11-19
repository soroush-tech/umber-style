import type { WebNested } from './webStyle'

/** A key that holds a nested style: a selector with `&`, one that starts with `:`, or an at-rule. */
export type NestedKey = `${string}&${string}` | `:${string}` | `@${string}`

/**
 * `{ [key]: style }` typed so that it can be spread into a web style. A key that is computed in an
 * object literal has the type `string`, and the web style type rejects it (its custom property
 * signature takes no style); the key here keeps its template literal type, and `style` is checked as a
 * style of its own: `{ ...at(`@media (width >= ${breakpoint})`, { gap: 16 }) }`.
 */
export function at<K extends NestedKey>(key: K, style: WebNested): Record<K, WebNested> {
  return { [key]: style } as Record<K, WebNested>
}
