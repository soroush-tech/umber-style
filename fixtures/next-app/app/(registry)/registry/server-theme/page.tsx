import { useTheme } from '@umber-style/react'

export const dynamic = 'force-dynamic'

// A server component that reads the theme of the default style, which nothing in this app configures:
// the theme of the providers file is given to a provider of a client file, never to `configure`.
export default function RegistryServerThemePage() {
  return <code data-testid="registry-server-theme">{JSON.stringify(useTheme())}</code>
}
