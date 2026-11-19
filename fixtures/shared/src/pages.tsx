import type { ReactNode } from 'react'
import {
  Badge,
  Button,
  Callout,
  Card,
  Flex,
  Heading,
  Hero,
  Muted,
  Page,
  Panel,
  ProductGrid,
} from './components'
import { ThemeProvider } from './style'
import { brandTheme } from './themes'

/** The pages are server-safe: no hook. `extra` is where a fixture puts its own interactive part. */
export function HomePage({ extra }: { extra?: ReactNode }) {
  return (
    <Page data-testid="page-home">
      <Hero data-testid="hero">
        <Heading>Home</Heading>
        <Muted>The first page</Muted>
      </Hero>
      <Flex gap={3} data-testid="home-row">
        <Card data-testid="home-card">
          <Flex direction="column" gap={2}>
            <Heading>Card</Heading>
            <Flex gap={2}>
              <Button data-testid="home-primary">Primary</Button>
              <Button variant="secondary" data-testid="home-secondary">
                Secondary
              </Button>
            </Flex>
          </Flex>
        </Card>
        {extra}
      </Flex>
    </Page>
  )
}

export function CatalogPage() {
  return (
    <Page data-testid="page-catalog">
      <Heading>Catalog</Heading>
      <ProductGrid data-testid="grid">
        {['One', 'Two', 'Three', 'Four'].map((name) => (
          <Card key={name} data-testid={`product-${name.toLowerCase()}`}>
            <Flex direction="column" gap={1}>
              <Badge>New</Badge>
              <Muted>{name}</Muted>
              <Button variant="outline">Add</Button>
            </Flex>
          </Card>
        ))}
      </ProductGrid>
    </Page>
  )
}

export function SettingsPage() {
  return (
    <Page data-testid="page-settings">
      <Heading>Settings</Heading>
      <Callout data-testid="callout">Uses the accent colour</Callout>
      <Flex direction="column" gap={3}>
        <Panel data-testid="panel">
          <Muted>Account</Muted>
          <Button variant="secondary">Edit</Button>
        </Panel>
        <ThemeProvider theme={brandTheme}>
          <Card data-testid="brand-card">
            <Muted>Inside the brand theme</Muted>
            <Button data-testid="brand-button">Brand</Button>
          </Card>
        </ThemeProvider>
      </Flex>
    </Page>
  )
}
