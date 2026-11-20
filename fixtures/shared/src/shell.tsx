import type { ComponentType, ReactNode } from 'react'
import { BaseStyles, NavBar } from './components'
import { FrameSwitch, Hydrated, ThemeSwitch } from './interactive'

export type LinkComponent = ComponentType<{
  href: string
  children: ReactNode
  'data-testid'?: string
}>

const DefaultLink: LinkComponent = ({ href, children, ...rest }) => (
  <a href={href} {...rest}>
    {children}
  </a>
)

/** The frame around every page: the global base styles, the bar with the links, the theme switch and the frame switch. */
export function Shell({
  children,
  Link = DefaultLink,
}: {
  children: ReactNode
  Link?: LinkComponent
}) {
  return (
    <>
      <BaseStyles />
      <div id="app-root" data-testid="app-root">
        <NavBar data-testid="nav">
          <Link href="/" data-testid="link-home">
            Home
          </Link>
          <Link href="/catalog" data-testid="link-catalog">
            Catalog
          </Link>
          <Link href="/settings" data-testid="link-settings">
            Settings
          </Link>
          <ThemeSwitch />
          <FrameSwitch />
        </NavBar>
        {children}
        <Hydrated />
      </div>
    </>
  )
}
