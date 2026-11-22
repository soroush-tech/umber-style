// What the files of the bindings share about the components they render: the five kinds of the
// 48-element cases, the props the layout component keeps to itself, the key of a combination, the tones
// of a cell, and the styles of the web components (React and Vue). Each binding makes its components
// from these with its own `styled`.
import type { StyleFunction, WebStyleObject } from '@umber-style/core'
import type { LayoutProps } from './styles'
import type { SmallTheme } from './themes'

/** The five kinds of the 48-element cases, and their names in a case. */
export const KINDS = ['fixed', 'themed', 'flex', 'override', 'entry'] as const
/** The name of one kind of the 48-element cases. */
export type Kind = (typeof KINDS)[number]
export const LABELS: Record<Kind, string> = {
  fixed: 'fixed styles only',
  themed: 'a function of the theme only',
  flex: 'prop-driven, 48 combinations',
  override: 'an override through style',
  entry: 'a single sheet entry in style',
}

/** The six props of the layout component, which it does not forward to its element. */
export const LAYOUT_PROPS: ReadonlySet<string> = new Set([
  'gap',
  'direction',
  'align',
  'justify',
  'wrap',
  'padding',
])

/** A key that tells the combination of props apart: the 48 are distinct. */
export const createLayoutKey = ({ gap, direction, align, justify, wrap }: LayoutProps): string =>
  [gap, direction, align, justify, wrap].join('|')

/** The four tones of a cell of the tree. */
export const TONES = ['a', 'b', 'c', 'd'] as const
/** The tone of one cell of the tree. */
export type Tone = (typeof TONES)[number]

/** The style of the web component with fixed styles only: no function, so no theme is read. */
export function createFixedStyle(): WebStyleObject {
  return { display: 'flex', padding: 8, color: 'red' }
}

/** The style of the web component that is a function of the theme only. */
export const themedStyle: StyleFunction<SmallTheme, object> = ({ theme }) => ({
  color: theme.palette.primary,
  padding: theme.space[2],
  borderRadius: theme.radii.md,
})

/** The part of a web cell's style that reads the theme. */
export const cellStyle: StyleFunction<SmallTheme, object> = ({ theme }) => ({
  color: theme.palette.text,
  padding: theme.space[1],
})

/** The entries of the web components' sheet: `root` has the declarations of the `override` kind. */
export function createSheetEntries() {
  return {
    root: { margin: 4, outline: '1px solid blue' },
    other: { margin: 8 },
  }
}
