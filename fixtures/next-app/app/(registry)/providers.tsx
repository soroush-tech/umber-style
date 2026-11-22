'use client'

import createCache from '@umber-style/cache'
import { CacheProvider } from '@umber-style/react'
import { Global, ThemeProvider } from '@umber-fixtures/shared/style'
import { lightTheme } from '@umber-fixtures/shared/themes'
import { useServerInsertedHTML } from 'next/navigation'
import { useState, type ReactNode } from 'react'

// The providers file that apps copy, with this repository's packages: a cache for each request, whose
// new rules are flushed into the stream with useServerInsertedHTML, then the theme and the global rules.
// The key is the prefix of the style that the components are made with (`umber`).
function useStyleRegistry() {
  const [{ cache, flush }] = useState(() => {
    const cache = createCache({ key: 'umber' })
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
        data-umber={`${cache.key} ${names.join(' ')}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    )
  })

  return cache
}

export default function Providers({ children }: Readonly<{ children: ReactNode }>) {
  const cache = useStyleRegistry()
  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={lightTheme}>
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
      </ThemeProvider>
    </CacheProvider>
  )
}
