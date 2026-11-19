import type { LinkComponent } from '@umber-fixtures/shared/shell'
import { useEffect, useState, type ReactNode } from 'react'

/** The path of the page, kept in step with the address bar. */
export function usePath(): string {
  const [path, setPath] = useState(() => window.location.pathname)
  useEffect(() => {
    const onChange = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onChange)
    window.addEventListener('navigate', onChange)
    return () => {
      window.removeEventListener('popstate', onChange)
      window.removeEventListener('navigate', onChange)
    }
  }, [])
  return path
}

/** A link that moves to the page in the browser, with no document load. */
export const Link: LinkComponent = ({ href, children, ...rest }) => (
  <a
    href={href}
    {...rest}
    onClick={(event) => {
      event.preventDefault()
      window.history.pushState({}, '', href)
      window.dispatchEvent(new Event('navigate'))
    }}
  >
    {children as ReactNode}
  </a>
)
