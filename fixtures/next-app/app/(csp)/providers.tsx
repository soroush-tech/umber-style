'use client'

import createCache from '@umber-style/cache'
import { CacheProvider } from '@umber-style/react'
import { Global, ThemeProvider } from '@umber-fixtures/shared/style'
import { darkTheme, lightTheme } from '@umber-fixtures/shared/themes'
import { useServerInsertedHTML } from 'next/navigation'
import { useState, type ReactNode } from 'react'

// The providers file of the registry (app/(registry)/providers.tsx) as an app writes it under a strict
// content security policy: the cache gets the nonce of the response, and the registry's own style
// element carries `nonce={cache.nonce}`. The nonce comes as a prop from the server layout, which read
// it from the request; in the browser the same prop gives the browser's cache its nonce, so the rules
// it writes after hydration are let in too. React's render takes its style nonce from the policy
// header of the request, which the framework reads.
function useStyleRegistry(nonce: string | undefined) {
  const [{ cache, flush }] = useState(() => {
    const cache = createCache({ key: 'umber', nonce })
    cache.compat = true
    const prevInsert = cache.insert
    let inserted: string[] = []
    cache.insert = (...args) => {
      const serialized = args[1]
      if (cache.inserted[serialized.name] === undefined) inserted.push(serialized.name)
      return prevInsert(...args)
    }
    const flush = () => {
      const prev = inserted
      inserted = []
      return prev
    }
    return { cache, flush }
  })

  useServerInsertedHTML(() => {
    const names = flush()
    if (names.length === 0) return null
    let styles = ''
    for (const name of names) styles += cache.inserted[name]
    return (
      <style
        key={cache.key}
        nonce={cache.nonce}
        data-umber={`${cache.key} ${names.join(' ')}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    )
  })

  return cache
}

// As in the registry, a button gives the outermost provider the dark theme: the browser's cache then
// writes the rules of that theme, after hydration, under the policy.
export default function Providers({
  nonce,
  children,
}: Readonly<{ nonce?: string; children: ReactNode }>) {
  const cache = useStyleRegistry(nonce)
  const [theme, setTheme] = useState(lightTheme)
  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <Global
          styles={(theme) => ({
            '*, *::before, *::after': { boxSizing: 'border-box' },
            body: {
              margin: 0,
              backgroundColor: theme.palette.background,
              color: theme.palette.text,
              fontFamily: 'sans-serif',
            },
          })}
        />
        {children}
        <button type="button" data-testid="csp-theme-switch" onClick={() => setTheme(darkTheme)}>
          Dark
        </button>
      </ThemeProvider>
    </CacheProvider>
  )
}
