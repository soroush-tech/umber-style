import { createElement, Fragment, type ReactElement } from 'react'
import type { Engine } from '@umber-style/core'
import { GlobalRelease } from './GlobalRelease'
import type { StyleSender } from './inlineStyles.server'
import { collectGlobalTexts, readGlobalSets } from './styleElements'
import { withNonce, type RequestNonce } from './serverContext'
import type { GlobalProps } from './types'

/**
 * Makes `Global` for server components: no hook, no context. A function of the theme reads the view of
 * the theme that `readTheme` gives: the base theme (references for tokens, real values for raw keys), else
 * the theme of the first provider of the request, else an empty theme. The rules are written into the cache
 * for good, as a server unmounts nothing, and sent as the style of each set and of the animations it uses,
 * which `sendStyles` makes with the nonce of the request: each `href` is sent once. After them comes
 * `GlobalRelease`, a client component (an import of a `'use client'` file is a reference to it here), with
 * the sets as plain data: in the browser it lets the cache take the rules over and release them when the
 * page is left.
 */
export function createGlobal<T>(
  engine: Engine<T>,
  readTheme: () => T,
  readNonce: () => RequestNonce,
  sendStyles: StyleSender
) {
  return function Global({ styles }: GlobalProps<T>): ReactElement | Promise<ReactElement> {
    const sets = readGlobalSets(engine, styles, engine.createThemeView(readTheme()))
    for (const set of sets) engine.cache.insertGlobal(set, { isRendered: true })
    const written = sets.filter(({ rules }) => rules.length > 0)
    const release =
      written.length === 0
        ? []
        : [
            createElement(GlobalRelease, {
              key: 'release',
              prefix: engine.cache.prefix,
              sets: JSON.stringify(written.map(({ id, rules }) => [id, rules])),
            }),
          ]
    return withNonce(readNonce(), (nonce) =>
      createElement(
        Fragment,
        null,
        ...sendStyles(collectGlobalTexts(engine.cache, sets), nonce),
        ...release
      )
    )
  }
}
