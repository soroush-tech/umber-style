'use client'

import { useState } from 'react'
import { styled } from './style'

// The client components of the interactive page under /csp-server: each one makes, in the browser, a class
// that the first HTML did not have, which the browser's cache of the client build writes into a style
// element of its own. The style of the client build has no nonce (a nonce for each request cannot be put in
// a bundle made once), so that element takes the nonce of the document, or the policy refuses it.

const Toggle = styled('button', { name: 'CspServerToggle' })<{ tone: 'calm' | 'loud' }>(
  ({ theme }) => ({
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: theme.palette.border,
  }),
  ({ tone, theme }) =>
    tone === 'loud' ? { paddingLeft: 22, color: theme.palette.accent } : { paddingLeft: 10 }
)

const Panel = styled('section', { name: 'CspServerPanel' })(({ theme }) => ({
  marginTop: theme.space[2],
  paddingLeft: 18,
  borderLeftWidth: 5,
  borderLeftStyle: 'solid',
  borderLeftColor: theme.palette.primary,
}))

/** A button whose tone changes on a click, to a class the first HTML does not have. */
export function ToneToggle() {
  const [tone, setTone] = useState<'calm' | 'loud'>('calm')
  return (
    <Toggle
      tone={tone}
      data-testid="csp-server-toggle"
      onClick={() => setTone(tone === 'calm' ? 'loud' : 'calm')}
    >
      {tone}
    </Toggle>
  )
}

/** A panel that renders only in the browser, after a click on its button. */
export function OpenPanel() {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <>
      <button type="button" data-testid="csp-server-open-panel" onClick={() => setIsOpen(true)}>
        Open
      </button>
      {isOpen && <Panel data-testid="csp-server-panel">Panel</Panel>}
    </>
  )
}
