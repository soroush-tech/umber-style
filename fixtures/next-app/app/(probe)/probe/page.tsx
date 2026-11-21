import { style } from '@umber-fixtures/shared/style'

export const dynamic = 'force-dynamic'

// A server component: `useTheme` gives the base theme, whatever the root layout's provider gives.
export default function ProbePage() {
  return <code data-testid="read-theme">{style.useTheme().breakpoints[0]}</code>
}
