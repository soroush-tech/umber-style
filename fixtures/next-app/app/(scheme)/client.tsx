'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button, Card } from '@umber-fixtures/shared/components'
import { style } from '@umber-fixtures/shared/style'
import { accentTheme, clientTheme, ROOT_COOKIE, type RootScheme } from '../client-themes'
import { ThemeProbe } from './theme-probe'

// The client components of the routes under /s: the client build of the binding.

/** Writes the other scheme in the cookie and asks the server for the page again: the root layout renders the other theme. */
export function RootSwitch({ scheme }: { scheme: RootScheme }) {
  const router = useRouter()
  const next = scheme === 'dark' ? 'light' : 'dark'
  const toggle = () => {
    document.cookie = `${ROOT_COOKIE}=${next}; path=/`
    router.refresh()
  }
  return (
    <Button variant="outline" data-testid="root-switch" data-scheme={scheme} onClick={toggle}>
      Root {next}
    </Button>
  )
}

/** A provider of the client build, around what the server renders inside it. */
export function ClientProvided({ children }: { children: ReactNode }) {
  return <style.ThemeProvider theme={clientTheme}>{children}</style.ThemeProvider>
}

/** `ThemeProbe` as a client component: what `useTheme` gives there, the theme of the nearest provider. */
export function ClientThemeProbe({ testId }: { testId: string }) {
  return <ThemeProbe testId={testId} />
}

/** Content in a portal under <body>, once mounted: with `ThemeScope`, without it, and with a provider inside. */
export function PortalProbe() {
  const [target, setTarget] = useState<HTMLElement | undefined>()
  useEffect(() => {
    setTarget(document.body)
  }, [])
  if (target === undefined) return null
  return createPortal(
    <div data-testid="s-portal">
      <style.ThemeScope>
        <Card data-testid="s-portal-scoped">Scoped</Card>
      </style.ThemeScope>
      <Card data-testid="s-portal-bare">Bare</Card>
      <style.ThemeProvider theme={accentTheme}>
        <Card data-testid="s-portal-provided">Provided</Card>
      </style.ThemeProvider>
    </div>,
    target
  )
}
