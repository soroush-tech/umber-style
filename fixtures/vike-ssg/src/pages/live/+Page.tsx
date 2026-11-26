import { styled } from '@umber-fixtures/shared/style'
import { useState } from 'react'

// A page whose classes are made in the browser after a click: a tone that the static HTML does not have,
// and a panel that only the browser renders. Served with a nonce injected on the way out
// (e2e/tests/vike-ssg.csp.spec.ts), the browser's cache writes their rules under the page's policy.

const Toggle = styled('button', { name: 'LiveToggle' })<{ tone: 'calm' | 'loud' }>(
  ({ theme }) => ({ borderWidth: 2, borderStyle: 'solid', borderColor: theme.palette.border }),
  ({ tone, theme }) =>
    tone === 'loud' ? { paddingLeft: 22, color: theme.palette.accent } : { paddingLeft: 10 }
)

const Opened = styled('section', { name: 'LivePanel' })(({ theme }) => ({
  paddingLeft: 18,
  borderLeftWidth: 5,
  borderLeftStyle: 'solid',
  borderLeftColor: theme.palette.primary,
}))

export default function Page() {
  const [tone, setTone] = useState<'calm' | 'loud'>('calm')
  const [isOpen, setIsOpen] = useState(false)
  return (
    <main data-testid="page-live">
      <Toggle
        tone={tone}
        data-testid="live-toggle"
        onClick={() => setTone(tone === 'calm' ? 'loud' : 'calm')}
      >
        {tone}
      </Toggle>
      <button type="button" data-testid="live-open" onClick={() => setIsOpen(true)}>
        Open
      </button>
      {isOpen && <Opened data-testid="live-panel">Panel</Opened>}
    </main>
  )
}
