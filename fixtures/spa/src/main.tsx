import { HeaderOverride } from '@umber-fixtures/shared/components'
import { CatalogPage, HomePage, PromoPage, SettingsPage } from '@umber-fixtures/shared/pages'
import { Shell } from '@umber-fixtures/shared/shell'
import { darkClass, lightClass, ThemeProvider } from '@umber-fixtures/shared/style'
import { STORAGE_KEY, lightTheme } from '@umber-fixtures/shared/themes'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Link, usePath } from './router'

// The class of the root theme goes on <html> before anything renders.
let stored: string | null = null
try {
  stored = localStorage.getItem(STORAGE_KEY)
} catch {
  // Storage can be blocked.
}
const isDark =
  stored === 'dark' || (stored === null && matchMedia('(prefers-color-scheme: dark)').matches)
document.documentElement.className = isDark ? darkClass : lightClass

function App() {
  const path = usePath()
  const Page = path === '/catalog' ? CatalogPage : path === '/settings' ? SettingsPage : HomePage
  return (
    <ThemeProvider theme={lightTheme} colorScheme="light" isRoot>
      <Shell Link={Link}>
        {path === '/promo' ? <PromoPage override={<HeaderOverride />} /> : <Page />}
      </Shell>
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
