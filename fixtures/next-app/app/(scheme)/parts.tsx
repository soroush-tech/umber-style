import { at } from '@umber-style/react'
import type { ReactNode } from 'react'
import { Muted } from '@umber-fixtures/shared/components'
import { globalStyles, keyframes, style, styled } from '@umber-fixtures/shared/style'
import { brandLight } from '../scheme-themes'

// Server components of the routes under /s that read the theme in the ways a provider must serve.

// `readTheme` exists in the server build only, so the shared style is typed without it.
const { readTheme, when, whenScheme } = style as unknown as typeof style & {
  readTheme: () => { palette: { surface: string } }
}

/** The surface of the root theme of the request, as a server component reads it. */
export function ReadThemeProbe() {
  return <Muted data-testid="s-read-theme">{readTheme().palette.surface}</Muted>
}

/** Dashed outline where the nearest theme is the light brand theme; underlined where the nearest scheme is dark. */
export const WhenProbe = styled('p', { name: 'WhenProbe' })({
  outlineWidth: 2,
  ...at(when(brandLight, 'light'), { outlineStyle: 'dashed' }),
  ...at(whenScheme('dark'), { textDecorationLine: 'underline' }),
})

const beat = keyframes(
  (theme) => ({
    from: { outlineColor: theme.palette.primary },
    to: { outlineColor: theme.palette.surface },
  }),
  { label: 'beat' }
)

/** An animation whose steps read a token, held at its first step: its outline is the primary colour where it is. */
export const Beat = styled('span', { name: 'Beat' })({
  display: 'inline-block',
  outlineStyle: 'solid',
  outlineWidth: 2,
  animationName: beat,
  animationDuration: 1000,
  animationPlayState: 'paused',
})

/** A global rule of the brand page that reads a token: it follows the theme where its target is. */
export const brandGlobal = globalStyles((theme) => ({
  '[data-testid="s-global-target"]': {
    outlineStyle: 'solid',
    outlineWidth: 2,
    outlineColor: theme.palette.primary,
  },
}))

/** The global rule of the root layout of /s: the page follows the root theme. */
export const rootGlobal = globalStyles((theme) => ({
  body: { margin: 0, backgroundColor: theme.palette.background, color: theme.palette.text },
}))

/** Renders `children` after `ms`: a part of the page that streams late. */
export async function Late({ ms, children }: { ms: number; children: ReactNode }) {
  await new Promise((resolve) => setTimeout(resolve, ms))
  return children
}
