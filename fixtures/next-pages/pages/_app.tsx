import { Shell, type LinkComponent } from '@umber-fixtures/shared/shell'
import { ThemeProvider } from '@umber-fixtures/shared/style'
import { lightTheme } from '@umber-fixtures/shared/themes'
import type { AppProps } from 'next/app'
import Link from 'next/link'

// One tree for the server render and the browser: the root provider, the frame, and the page.
export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider theme={lightTheme} colorScheme="light" isRoot>
      <Shell Link={Link as LinkComponent}>
        <Component {...pageProps} />
      </Shell>
    </ThemeProvider>
  )
}
