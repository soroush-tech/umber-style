import { style } from '@umber-fixtures/shared/style'

export const dynamic = 'force-dynamic'

// `readTheme` exists in the server build only, so the shared style is typed without it.
const { readTheme } = style as unknown as { readTheme: () => { breakpoints: string[] } }

export default function ProbePage() {
  return <code data-testid="read-theme">{readTheme().breakpoints[0]}</code>
}
