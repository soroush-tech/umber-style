import { brandTheme, lightTheme, STORAGE_KEY } from '@umber-fixtures/shared/themes'
import { defineComponent, h, onMounted, ref, type VNode } from 'vue'
import {
  Badge,
  baseStyles,
  Button,
  Callout,
  Card,
  Flex,
  frameStyles,
  headerOverride,
  Heading,
  Hero,
  Muted,
  NavBar,
  Page,
  Panel,
  ProductGrid,
  Pulse,
  Spinner,
} from './components'
import { darkClass, Global, lightClass, ThemeProvider } from './style'

const createTextSlot = (value: string) => () => value

const HomePage = () =>
  h(Page, { 'data-testid': 'page-home' }, () => [
    h(Hero, { 'data-testid': 'hero' }, () => [
      h(Heading, null, createTextSlot('Home')),
      h(Muted, null, createTextSlot('The first page')),
      h(Flex, { gap: 2, 'data-testid': 'animations' }, () => [
        h(Spinner, { 'data-testid': 'spinner' }),
        h(Pulse, { 'data-testid': 'pulse' }),
      ]),
    ]),
    h(Flex, { gap: 3, 'data-testid': 'home-row' }, () =>
      h(Card, { 'data-testid': 'home-card' }, () =>
        h(Flex, { direction: 'column', gap: 2 }, () => [
          h(Heading, null, createTextSlot('Card')),
          h(Flex, { gap: 2 }, () => [
            h(Button, { 'data-testid': 'home-primary' }, createTextSlot('Primary')),
            h(
              Button,
              { variant: 'secondary', 'data-testid': 'home-secondary' },
              createTextSlot('Secondary')
            ),
          ]),
        ])
      )
    ),
  ])

const CatalogPage = () =>
  h(Page, { 'data-testid': 'page-catalog' }, () => [
    h(Heading, null, createTextSlot('Catalog')),
    h(ProductGrid, { 'data-testid': 'grid' }, () =>
      ['One', 'Two', 'Three', 'Four'].map((name) =>
        h(Card, { key: name, 'data-testid': `product-${name.toLowerCase()}` }, () =>
          h(Flex, { direction: 'column', gap: 1 }, () => [
            h(Badge, null, createTextSlot('New')),
            h(Muted, null, createTextSlot(name)),
            h(Button, { variant: 'outline' }, createTextSlot('Add')),
          ])
        )
      )
    ),
  ])

const SettingsPage = () =>
  h(Page, { 'data-testid': 'page-settings' }, () => [
    h(Heading, null, createTextSlot('Settings')),
    h(Callout, { 'data-testid': 'callout' }, createTextSlot('Uses the accent colour')),
    h(Flex, { direction: 'column', gap: 3 }, () => [
      h(Panel, { 'data-testid': 'panel' }, () => [
        h(Muted, null, createTextSlot('Account')),
        h(Button, { variant: 'secondary' }, createTextSlot('Edit')),
      ]),
      h(ThemeProvider, { theme: brandTheme }, () =>
        h(Card, { 'data-testid': 'brand-card' }, () => [
          h(Muted, null, createTextSlot('Inside the brand theme')),
          h(Button, { 'data-testid': 'brand-button' }, createTextSlot('Brand')),
        ])
      ),
    ]),
  ])

// A global rule for the bar, which is outside the page: leaving the page unmounts it.
const PromoPage = () =>
  h(Page, { 'data-testid': 'page-promo' }, () => [
    h(Global, { styles: headerOverride }),
    h(Heading, null, createTextSlot('Promo')),
    h(Muted, null, createTextSlot('This page outlines the bar above it')),
  ])

const PAGES: Record<string, () => VNode> = {
  '/': HomePage,
  '/catalog': CatalogPage,
  '/settings': SettingsPage,
  '/promo': PromoPage,
}

/** The path moves with the address bar, and with the links of the app. */
export const createApp = (initialPath: string) =>
  defineComponent({
    setup() {
      const path = ref(initialPath)
      // The global styles of the frame are on at first, also in the first HTML.
      const isFrameOn = ref(true)
      onMounted(() => {
        document.documentElement.dataset.hydrated = 'true'
        window.addEventListener('popstate', () => (path.value = window.location.pathname))
      })
      const go = (href: string) => (event: Event) => {
        event.preventDefault()
        window.history.pushState({}, '', href)
        path.value = href
      }
      const toggle = () => {
        const isDark = document.documentElement.className === darkClass
        document.documentElement.className = isDark ? lightClass : darkClass
        try {
          localStorage.setItem(STORAGE_KEY, isDark ? 'light' : 'dark')
        } catch {
          // Storage can be blocked: the switch still works for this page.
        }
      }
      const createLink = (href: string, label: string, id: string) =>
        h('a', { href, 'data-testid': id, onClick: go(href) }, label)
      return () =>
        h(ThemeProvider, { theme: lightTheme, colorScheme: 'light', isRoot: true }, () => [
          h(Global, { styles: baseStyles }),
          isFrameOn.value ? h(Global, { styles: frameStyles }) : null,
          h('div', { id: 'app-root', 'data-testid': 'app-root' }, [
            h(NavBar, { 'data-testid': 'nav' }, () => [
              createLink('/', 'Home', 'link-home'),
              createLink('/catalog', 'Catalog', 'link-catalog'),
              createLink('/settings', 'Settings', 'link-settings'),
              createLink('/promo', 'Promo', 'link-promo'),
              h(
                Button,
                { variant: 'outline', 'data-testid': 'theme-switch', onClick: toggle },
                createTextSlot('Switch theme')
              ),
              h(
                Button,
                {
                  variant: 'outline',
                  'data-testid': 'frame-switch',
                  onClick: () => (isFrameOn.value = !isFrameOn.value),
                },
                createTextSlot('Switch frame')
              ),
            ]),
            (PAGES[path.value] ?? HomePage)(),
          ]),
        ])
    },
  })
