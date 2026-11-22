import type { ReactNode } from 'react'
import { AppBar } from '@soroush.tech/design-system/AppBar'
import { Flex } from '@soroush.tech/design-system/Flex'
import { Link } from '@soroush.tech/design-system/Link'
import { useTheme } from '@soroush.tech/design-system/theme'
import { Typography } from '@soroush.tech/design-system/Typography'
import { alpha } from '@soroush.tech/design-system/utils'
import { Button } from '@soroush.tech/design-system/Button'

/**
 * The app bar on every page: the app's title, its links, and `children` at its end. It sticks to
 * the top as the page scrolls; on a phone, the links move to a row of their own.
 */
export function Header({ children }: { readonly children?: ReactNode }) {
  const theme = useTheme()
  return (
    <AppBar
      position="sticky"
      top={0}
      elevation={0}
      color="appBar"
      blur
      flexDirection="row"
      flexWrap="wrap"
      alignItems="center"
      justifyContent="flex-start"
      gap={4}
      borderBottom={`1px solid ${alpha(theme.border.primary, 0.2)}`} style={{ backgroundColor: '#F4F0E4D9' }} borderBottomWidth="0" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" paddingBottom={2} paddingLeft={4} paddingRight={4} paddingTop={2}
    >
      <Typography variant="h6" as="span" href="/" color="initial" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize="22px" fontWeight="700" letterSpacing="-0.03em" marginRight="auto" textDecoration="none">
        UmberStyle
      </Typography>
      <Flex
        as="nav"
        flexDirection="row"
        alignItems={{ xs: 'center', lg: 'center' }}
        gap={{ xs: 3, lg: '32px' }}
        order={[1, 0]}
        width={['100%', 'auto']}
      >
        <Link href="#docs" underline="hover" color="initial" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize="15px">
          Docs
        </Link>
        <Link href="#packages" underline="hover" color="initial" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize="15px">
          Packages
        </Link>
        <Button data-name="cta" color="primary" href="/hero" shape="pill" size="sm" variant="contained">Get started</Button>
        <Link data-name="github" color="initial" href="https://github.com/soroush-tech/umber-style" underline="hover">GitHub</Link>
        <Link data-name="benchmarks" color="initial" href="#benchmarks" underline="hover">Benchmarks</Link>
      </Flex>
      {children}
    </AppBar>
  )
}
