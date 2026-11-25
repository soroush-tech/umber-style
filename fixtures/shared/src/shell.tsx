import type { ComponentType, ReactNode } from 'react'
import { BaseStyles, NavBar } from './components'
import { FrameSwitch, Hydrated, IdProbe, ThemeSwitch } from './interactive'

/** The component the shell renders its links with: a plain `<a>` by default, or the link of a fixture's router. */
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

/**
 * The frame around every page: the global base styles, the bar with the links, the theme switch, the
 * frame switch, and the probe of `useId`, which stays mounted from page to page. `links` are more links of a fixture, after the shared ones.
 */
export function Shell({
  children,
  Link = DefaultLink,
  links,
}: {
  children: ReactNode
  Link?: LinkComponent
  links?: ReactNode
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
          <Link href="/promo" data-testid="link-promo">
            Promo
          </Link>
          {links}
          <ThemeSwitch />
          <FrameSwitch />
          <IdProbe />
        </NavBar>
        {children}
        <Hydrated />
      </div>
    </>
  )
}
