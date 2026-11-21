import { Muted } from '@umber-fixtures/shared/components'
import { style } from '@umber-fixtures/shared/style'

// One component, written once, that prints the surface and the primary colour that `useTheme()` gives.
// A server file renders it as a server component (the base theme), and `ClientThemeProbe` of client.tsx
// renders it as a client component (the theme of the nearest provider): the code is the same.
export function ThemeProbe({ testId }: { testId: string }) {
  const { palette } = style.useTheme()
  return <Muted data-testid={testId}>{`${palette.surface} ${palette.primary}`}</Muted>
}
