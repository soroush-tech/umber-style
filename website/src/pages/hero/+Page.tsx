import { Button } from '@soroush.tech/design-system/Button'
import { Flex } from '@soroush.tech/design-system/Flex'
import { Grid } from '@soroush.tech/design-system/Grid'
import { Image } from '@soroush.tech/design-system/Image'
import { Link } from '@soroush.tech/design-system/Link'
import { Typography } from '@soroush.tech/design-system/Typography'

export default function Page() {
  return (
    <main>
      <Flex alignItems="center" data-name="root" flexDirection="column" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" gap={0} p={0} style={{"backgroundColor":"rgba(247, 241, 225, 1)","color":"#2F1702"}} width="100%">
        <Flex alignItems="center" data-name="bar" flexDirection="row" gap={0} justifyContent="space-between" maxWidth="1760px" p={0} px={3} py={2} width="100%">
          <Typography data-name="brand" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" letterSpacing="-0.03em" m={0} style={{"fontSize":"22px","fontWeight":700}} variant="h5">UmberStyle</Typography>
          <Flex alignItems="center" data-name="nav" flexDirection="row" gap={4} p={0}>
            <Link color="inherit" data-name="n1" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" href="#" style={{"fontSize":"15px"}} underline="none">Docs</Link>
            <Link color="inherit" data-name="n2" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" href="#" style={{"fontSize":"15px"}} underline="none">Packages</Link>
            <Link color="inherit" data-name="n3" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" href="#" style={{"fontSize":"15px"}} underline="none">Benchmarks</Link>
            <Link color="inherit" data-name="n4" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" href="#" style={{"fontSize":"15px"}} underline="none">GitHub</Link>
            <Button color="primary" data-name="navCta" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize={1} px={3} size="sm" style={{"backgroundColor":"rgba(47, 23, 2, 1)","borderColor":"#2F1702","borderRadius":"999px","color":"#F7F1E1","letterSpacing":"0px"}} textTransform="none" variant="contained">Get started</Button>
          </Flex>
        </Flex>
        <Flex data-name="rule1" flexShrink="0" gap={0} height="1px" p={0} style={{"backgroundImage":"repeating-linear-gradient(to right, color-mix(in srgb, currentColor 32%, transparent) 0 16px, transparent 16px 32px)"}} width="100%" />
        <Flex alignItems="center" borderLeftStyle="solid" borderLeftWidth="0" data-name="hero" flexDirection="row" gap={0} maxWidth="1920px" p={0} style={{"borderLeftColor":"#2F170224"}} width="100%">
          <Grid data-name="sideL" display="grid" flexShrink="0" gap={0} gridTemplateColumns="repeat(2, 1fr)" gridTemplateRows="repeat(4, 1fr)" p={0} position="relative" width="200px" style={{"borderLeftWidth":"0","display":"flex","flexShrink":"0","height":"700px","position":"relative","width":"300px"}}>
            <Image alt="Squares left" height="700px" left="0" position="absolute" src="/95cea2cf050b318e56bf71b695b1759937372efcbcd4d5d4f1b993175c571204.svg" top="0" width="300px" />
          </Grid>
          <Flex alignItems="center" data-name="mid" flex="1 1 0" flexDirection="row" gap={8} minWidth="0" px={6} py={6} style={{"paddingBottom":"104px","paddingTop":"96px"}}>
            <Flex alignItems="flex-start" data-name="copy" flex="5 1 0" flexDirection="column" gap={3} minWidth="0" p={0}>
              <Flex alignItems="center" borderColor="#2F170224" borderStyle="solid" borderWidth="1px" data-name="badge" flexDirection="row" gap={1} p={0} px={1.5} py={0.5} style={{"backgroundColor":"rgba(255, 251, 240, 1)","borderRadius":"999px"}}>
                <Flex data-name="badgeDot" gap={0} height="8px" p={0} style={{"backgroundColor":"rgba(18, 161, 80, 1)","borderRadius":"999px"}} width="8px" />
                <Typography data-name="badgeText" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} variant="caption">Runtime CSS engine / v0.1 alpha</Typography>
              </Flex>
              <Typography data-name="h1a" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" letterSpacing="-0.05em" lineHeight="0.98" m={0} style={{"fontSize":"84px","fontWeight":700}} variant="h1">Write styled once.</Typography>
              <Typography data-name="h1b" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" letterSpacing="-0.05em" lineHeight="0.98" mb={0} mx={0} style={{"color":"#2F5BEA","fontSize":"84px","fontWeight":700,"marginTop":"-18px"}} variant="h1">Ship it everywhere.</Typography>
              <Typography data-name="lead" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" lineHeight="1.55" m={0} maxWidth="560px" style={{"color":"#6B5A45","fontSize":"19px"}} variant="body1">The API you already know, over an engine that turns tokens into CSS variables. One class for every theme, one component file for React, Vue and React Native.</Typography>
              <Flex data-name="actions" flexDirection="row" gap={1.5} p={0}>
                <Button borderRadius="md" color="primary" data-name="b1" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize={2} size="lg" style={{"backgroundColor":"rgba(47, 23, 2, 1)","borderColor":"#2F1702","boxShadow":"0 6px 0 color-mix(in srgb, currentColor 18%, transparent)","color":"#F7F1E1","letterSpacing":"0px"}} textTransform="none" variant="contained">Start building</Button>
                <Button borderRadius="md" color="primary" data-name="b2" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize={2} size="lg" style={{"backgroundColor":"rgba(255, 251, 240, 1)","borderColor":"#2F1702","color":"#2F1702","letterSpacing":"0px"}} textTransform="none" variant="outlined">Read the docs</Button>
              </Flex>
              <Flex borderBottomStyle="dashed" borderBottomWidth="1px" borderLeftStyle="dashed" borderLeftWidth="1px" borderRadius="sm" borderRightStyle="dashed" borderRightWidth="1px" borderTopStyle="dashed" borderTopWidth="1px" data-name="install" flexDirection="row" gap={1.5} p={0} px={2} py={1} style={{"borderBottomColor":"#2F1702","borderLeftColor":"#2F1702","borderRightColor":"#2F1702","borderTopColor":"#2F1702"}}>
                <Typography data-name="installPrompt" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} style={{"color":"#F0442C"}} variant="body2">$</Typography>
                <Typography data-name="installText" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} variant="body2">pnpm add @umber-style/react</Typography>
              </Flex>
            </Flex>
            <Flex data-name="panel" flex="6 1 0" flexDirection="column" gap={3} minWidth="0" p={0} pb={8} pt={5} px={5} style={{"backgroundColor":"rgba(47, 91, 234, 1)","backgroundImage":"linear-gradient(140deg, transparent 25%, currentColor 115%), radial-gradient(color-mix(in srgb, currentColor 40%, transparent) 1px, transparent 1.5px)","backgroundSize":"auto, 8px 8px","borderRadius":"28px","color":"#E0457B"}}>
              <Flex alignSelf="flex-start" data-name="tabs" flexDirection="row" gap={0.5} p={0.5} style={{"backgroundColor":"rgba(255, 251, 240, 1)","borderRadius":"12px"}}>
                <Typography borderRadius="md" data-name="tab1" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" m={0} px={2} py={1} style={{"backgroundColor":"rgba(47, 23, 2, 1)","color":"#F7F1E1","fontSize":"15px","fontWeight":600}} variant="body2">React</Typography>
                <Typography data-name="tab2" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" m={0} px={2} py={1} style={{"color":"#2F1702","fontSize":"15px"}} variant="body2">Vue</Typography>
                <Typography data-name="tab3" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" m={0} px={2} py={1} style={{"color":"#2F1702","fontSize":"15px"}} variant="body2">React Native</Typography>
                <Typography data-name="tab4" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" m={0} px={2} py={1} style={{"color":"#2F1702","fontSize":"15px"}} variant="body2">Server</Typography>
              </Flex>
              <Flex borderRadius="lg" data-name="window" flexDirection="column" gap={0} overflow="hidden" p={0} style={{"backgroundColor":"rgba(26, 13, 1, 1)","color":"#F7F1E1"}}>
                <Typography borderBottomStyle="dashed" borderBottomWidth="1px" data-name="file" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} opacity={0.7} px={3} py={1.5} style={{"borderBottomColor":"color-mix(in srgb, currentColor 35%, transparent)","color":"#F7F1E1"}} variant="caption">Card.tsx</Typography>
                <Flex data-name="winBody" flexDirection="column" gap={0} p={3}>
                  <Typography data-name="ln0" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" lineHeight="1.8" m={0} minHeight="27px" style={{"color":"#F7F1E1","fontSize":"15px","fontVariantLigatures":"none"}} variant="body2" whiteSpace="pre">{"const Card = styled('div')(({ theme }) => ({"}</Typography>
                  <Typography data-name="ln1" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" lineHeight="1.8" m={0} minHeight="27px" style={{"color":"#F7F1E1","fontSize":"15px","fontVariantLigatures":"none"}} variant="body2" whiteSpace="pre">{"  padding: theme.space[3],"}</Typography>
                  <Typography data-name="ln2" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" lineHeight="1.8" m={0} minHeight="27px" style={{"color":"#F7F1E1","fontSize":"15px","fontVariantLigatures":"none"}} variant="body2" whiteSpace="pre">{"  color: theme.palette.text,"}</Typography>
                  <Typography data-name="ln3" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" lineHeight="1.8" m={0} minHeight="27px" style={{"color":"#F7F1E1","fontSize":"15px","fontVariantLigatures":"none"}} variant="body2" whiteSpace="pre">{"  background: theme.palette.surface,"}</Typography>
                  <Typography data-name="ln4" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" lineHeight="1.8" m={0} minHeight="27px" style={{"color":"#F7F1E1","fontSize":"15px","fontVariantLigatures":"none"}} variant="body2" whiteSpace="pre">{"}))"}</Typography>
                  <Typography data-name="ln5" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" lineHeight="1.8" m={0} minHeight="27px" style={{"color":"#F7F1E1","fontSize":"15px","fontVariantLigatures":"none"}} variant="body2" whiteSpace="pre">{" "}</Typography>
                  <Typography data-name="ln6" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" lineHeight="1.8" m={0} minHeight="27px" style={{"color":"#F7F1E1","fontSize":"15px","fontVariantLigatures":"none"}} variant="body2" whiteSpace="pre">{"<ThemeProvider theme={dark}>"}</Typography>
                  <Typography data-name="ln7" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" lineHeight="1.8" m={0} minHeight="27px" style={{"color":"#F7F1E1","fontSize":"15px","fontVariantLigatures":"none"}} variant="body2" whiteSpace="pre">{"  <Card />"}</Typography>
                  <Typography data-name="ln8" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" lineHeight="1.8" m={0} minHeight="27px" style={{"color":"#F7F1E1","fontSize":"15px","fontVariantLigatures":"none"}} variant="body2" whiteSpace="pre">{"</ThemeProvider>"}</Typography>
                </Flex>
              </Flex>
            </Flex>
          </Flex>
          <Grid borderLeftStyle="solid" borderLeftWidth="1px" data-name="sideR" display="grid" flexShrink="0" gap={0} gridTemplateColumns="repeat(2, 1fr)" gridTemplateRows="repeat(4, 1fr)" p={0} position="relative" style={{"borderLeftColor":"#2F170224","borderLeftWidth":"0","display":"flex","flexShrink":"0","height":"700px","position":"relative","width":"300px"}} width="200px">
            <Image alt="Squares right" height="700px" left="0" position="absolute" src="/4ca36d1ffc799711e0d6cc2ae44fe9a5918fc6ecd44e38ba7803445c90caffae.svg" top="0" width="300px" />
          </Grid>
        </Flex>
        <Flex data-name="rule2" flexShrink="0" gap={0} height="1px" p={0} style={{"backgroundImage":"repeating-linear-gradient(to right, color-mix(in srgb, currentColor 32%, transparent) 0 16px, transparent 16px 32px)"}} width="100%" />
        <Flex data-name="body" gap={0} maxWidth="1760px" pb={0} pt={0} style={{"backgroundImage":"radial-gradient(color-mix(in srgb, currentColor 26%, transparent) 1px, transparent 1.5px)","backgroundSize":"12px 12px","paddingLeft":"200px","paddingRight":"200px"}} width="100%">
          <Flex alignItems="center" data-name="content" flexDirection="column" gap={6} px={6} style={{"backgroundColor":"rgba(247, 241, 225, 1)","backgroundImage":"repeating-linear-gradient(to bottom, color-mix(in srgb, currentColor 32%, transparent) 0 12px, transparent 12px 24px), repeating-linear-gradient(to bottom, color-mix(in srgb, currentColor 32%, transparent) 0 12px, transparent 12px 24px)","backgroundPosition":"left top, right top","backgroundRepeat":"no-repeat","backgroundSize":"1px 100%, 1px 100%","paddingBottom":"104px","paddingTop":"104px"}} width="100%">
            <Flex alignItems="center" data-name="whyHead" flexDirection="column" gap={2} p={0} textAlign="center">
              <Typography data-name="whyLabel" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" letterSpacing="0.14em" m={0} style={{"color":"#F0442C"}} variant="overline">Why UmberStyle</Typography>
              <Typography align="center" data-name="whyTitle" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" letterSpacing="-0.05em" lineHeight="1.02" m={0} maxWidth="820px" style={{"fontSize":"56px","fontWeight":700}} variant="h2">Everything a design system asks of its engine</Typography>
            </Flex>
            <Grid borderColor="#2F170224" borderStyle="solid" borderWidth="1px" data-name="stats" display="grid" gap={0} gridTemplateColumns="repeat(4, 1fr)" p={0} position="relative" width="100%">
              <Flex data-name="s1" flexDirection="column" gap={1} p={4}>
                <Typography data-name="s1n" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" letterSpacing="-0.05em" lineHeight="1" m={0} style={{"color":"#F0442C","fontSize":"64px","fontWeight":500}} variant="h2">1</Typography>
                <Typography data-name="s1l" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" letterSpacing="0.06em" m={0} style={{"color":"#6B5A45"}} variant="overline">class for each component, in every theme</Typography>
              </Flex>
              <Flex borderLeftStyle="solid" borderLeftWidth="1px" data-name="s2" flexDirection="column" gap={1} p={4} style={{"borderLeftColor":"#2F170224"}}>
                <Typography data-name="s2n" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" letterSpacing="-0.05em" lineHeight="1" m={0} style={{"color":"#2F5BEA","fontSize":"64px","fontWeight":500}} variant="h2">0</Typography>
                <Typography data-name="s2l" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" letterSpacing="0.06em" m={0} style={{"color":"#6B5A45"}} variant="overline">renders when the theme switches</Typography>
              </Flex>
              <Flex borderLeftStyle="solid" borderLeftWidth="1px" data-name="s3" flexDirection="column" gap={1} p={4} style={{"borderLeftColor":"#2F170224"}}>
                <Typography data-name="s3n" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" letterSpacing="-0.05em" lineHeight="1" m={0} style={{"color":"#12A150","fontSize":"64px","fontWeight":500}} variant="h2">3</Typography>
                <Typography data-name="s3l" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" letterSpacing="0.06em" m={0} style={{"color":"#6B5A45"}} variant="overline">platforms from one component source</Typography>
              </Flex>
              <Flex borderLeftStyle="solid" borderLeftWidth="1px" data-name="s4" flexDirection="column" gap={1} p={4} style={{"borderLeftColor":"#2F170224"}}>
                <Typography data-name="s4n" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" letterSpacing="-0.05em" lineHeight="1" m={0} style={{"color":"#F2A900","fontSize":"64px","fontWeight":500}} variant="h2">100%</Typography>
                <Typography data-name="s4l" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" letterSpacing="0.06em" m={0} style={{"color":"#6B5A45"}} variant="overline">test coverage in every package</Typography>
              </Flex>
              <Flex borderColor="color-mix(in srgb, currentColor 35%, transparent)" borderRadius="sm" borderStyle="solid" borderWidth="1px" data-name="sc0" gap={0} height="14px" left="-8px" p={0} position="absolute" style={{"backgroundColor":"rgba(247, 241, 225, 1)"}} top="-8px" width="14px" />
              <Flex borderColor="color-mix(in srgb, currentColor 35%, transparent)" borderRadius="sm" borderStyle="solid" borderWidth="1px" data-name="sc1" gap={0} height="14px" p={0} position="absolute" right="-8px" style={{"backgroundColor":"rgba(247, 241, 225, 1)"}} top="-8px" width="14px" />
              <Flex borderColor="color-mix(in srgb, currentColor 35%, transparent)" borderRadius="sm" borderStyle="solid" borderWidth="1px" bottom="-8px" data-name="sc2" gap={0} height="14px" left="-8px" p={0} position="absolute" style={{"backgroundColor":"rgba(247, 241, 225, 1)"}} width="14px" />
              <Flex borderColor="color-mix(in srgb, currentColor 35%, transparent)" borderRadius="sm" borderStyle="solid" borderWidth="1px" bottom="-8px" data-name="sc3" gap={0} height="14px" p={0} position="absolute" right="-8px" style={{"backgroundColor":"rgba(247, 241, 225, 1)"}} width="14px" />
            </Grid>
            <Grid borderColor="#2F170224" borderStyle="solid" borderWidth="1px" data-name="features" display="grid" gap={0} gridTemplateColumns="repeat(3, 1fr)" p={0} position="relative" width="100%">
              <Flex borderBottomStyle="solid" borderBottomWidth="1px" data-name="f1" flexDirection="column" gap={1.5} p={5} style={{"borderBottomColor":"#2F170224"}}>
                <Flex alignItems="center" data-name="f1i" gap={0} height="48px" justifyContent="center" mb={1} p={0} style={{"backgroundColor":"rgba(240, 68, 44, 1)","borderRadius":"14px","boxShadow":"0 5px 0 color-mix(in srgb, currentColor 14%, transparent)"}} width="48px">
                  <Image alt="g0" height="30px" src="/788b812e984ba368a398b338882f4fcbb51012c402b95b528db0ccaf7f8e8912.svg" width="30px" />
                </Flex>
                <Typography as="h5" data-name="f1h" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" letterSpacing="-0.02em" m={0} variant="h3">Tokens are variables</Typography>
                <Typography data-name="f1t" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" lineHeight="1.55" m={0} style={{"color":"#6B5A45"}} variant="body1">Every theme value becomes a CSS variable. A class points at the variable, so it is written once for all themes.</Typography>
              </Flex>
              <Flex borderBottomStyle="solid" borderBottomWidth="1px" borderLeftStyle="solid" borderLeftWidth="1px" data-name="f2" flexDirection="column" gap={1.5} p={5} style={{"borderBottomColor":"#2F170224","borderLeftColor":"#2F170224"}}>
                <Flex alignItems="center" data-name="f2i" gap={0} height="48px" justifyContent="center" mb={1} p={0} style={{"backgroundColor":"rgba(47, 91, 234, 1)","borderRadius":"14px","boxShadow":"0 5px 0 color-mix(in srgb, currentColor 14%, transparent)"}} width="48px">
                  <Image alt="g1" height="30px" src="/c2469e3f5d72dcf6684340b7444498322c2958050a6a6109c2e7605b03ab27be.svg" width="30px" />
                </Flex>
                <Typography as="h5" data-name="f2h" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" letterSpacing="-0.02em" m={0} variant="h3">Web and mobile</Typography>
                <Typography data-name="f2t" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" lineHeight="1.55" m={0} style={{"color":"#6B5A45"}} variant="body1">styled, ThemeProvider and useTheme with the same names on React, Vue and React Native.</Typography>
              </Flex>
              <Flex borderBottomStyle="solid" borderBottomWidth="1px" borderLeftStyle="solid" borderLeftWidth="1px" data-name="f3" flexDirection="column" gap={1.5} p={5} style={{"borderBottomColor":"#2F170224","borderLeftColor":"#2F170224"}}>
                <Flex alignItems="center" data-name="f3i" gap={0} height="48px" justifyContent="center" mb={1} p={0} style={{"backgroundColor":"rgba(18, 161, 80, 1)","borderRadius":"14px","boxShadow":"0 5px 0 color-mix(in srgb, currentColor 14%, transparent)"}} width="48px">
                  <Image alt="g2" height="30px" src="/d444292ee2e54039c3924210d61651a3b144b6a682a9d6b9092b9e3bfc4c2a42.svg" width="30px" />
                </Flex>
                <Typography as="h5" data-name="f3h" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" letterSpacing="-0.02em" m={0} variant="h3">Every way to render</Typography>
                <Typography data-name="f3t" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" lineHeight="1.55" m={0} style={{"color":"#6B5A45"}} variant="body1">Static pages, streaming, server components and hydration that adopts the CSS already sent.</Typography>
              </Flex>
              <Flex data-name="f4" flexDirection="column" gap={1.5} p={5}>
                <Flex alignItems="center" data-name="f4i" gap={0} height="48px" justifyContent="center" mb={1} p={0} style={{"backgroundColor":"rgba(242, 169, 0, 1)","borderRadius":"14px","boxShadow":"0 5px 0 color-mix(in srgb, currentColor 14%, transparent)"}} width="48px">
                  <Image alt="g3" height="30px" src="/2122427d8f190d9b89729eba8f2d540224ab2136827dc09a416d5e2fb303a725.svg" width="30px" />
                </Flex>
                <Typography as="h5" data-name="f4h" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" letterSpacing="-0.02em" m={0} variant="h3">Order by design</Typography>
                <Typography data-name="f4t" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" lineHeight="1.55" m={0} style={{"color":"#6B5A45"}} variant="body1">Rules live in cascade layers, so which one wins never depends on which component loaded first.</Typography>
              </Flex>
              <Flex borderLeftStyle="solid" borderLeftWidth="1px" data-name="f5" flexDirection="column" gap={1.5} p={5} style={{"borderLeftColor":"#2F170224"}}>
                <Flex alignItems="center" data-name="f5i" gap={0} height="48px" justifyContent="center" mb={1} p={0} style={{"backgroundColor":"rgba(224, 69, 123, 1)","borderRadius":"14px","boxShadow":"0 5px 0 color-mix(in srgb, currentColor 14%, transparent)"}} width="48px">
                  <Image alt="g4" height="30px" src="/645ae27f8d23b9a1327cfeeea17f3e99562dcc57bcc120aed4aebabe72cb7d3a.svg" width="30px" />
                </Flex>
                <Typography as="h5" data-name="f5h" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" letterSpacing="-0.02em" m={0} variant="h3">Speed that is measured</Typography>
                <Typography data-name="f5t" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" lineHeight="1.55" m={0} style={{"color":"#6B5A45"}} variant="body1">Each release runs against the last in a sandbox. A slower engine does not ship.</Typography>
              </Flex>
              <Flex borderLeftStyle="solid" borderLeftWidth="1px" data-name="f6" flexDirection="column" gap={1.5} p={5} style={{"borderLeftColor":"#2F170224"}}>
                <Flex alignItems="center" data-name="f6i" gap={0} height="48px" justifyContent="center" mb={1} p={0} style={{"backgroundColor":"rgba(47, 23, 2, 1)","borderRadius":"14px","boxShadow":"0 5px 0 color-mix(in srgb, currentColor 14%, transparent)"}} width="48px">
                  <Image alt="g5" height="30px" src="/6dc16080d9d94f363551fa43b37eba46ca40b9933ded034acd3fc240ad60930b.svg" width="30px" />
                </Flex>
                <Typography as="h5" data-name="f6h" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" letterSpacing="-0.02em" m={0} variant="h3">Typed to the token</Typography>
                <Typography data-name="f6t" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" lineHeight="1.55" m={0} style={{"color":"#6B5A45"}} variant="body1">Theme paths, props and values are checked by TypeScript before the page ever loads.</Typography>
              </Flex>
              <Flex borderColor="color-mix(in srgb, currentColor 35%, transparent)" borderRadius="sm" borderStyle="solid" borderWidth="1px" data-name="fc0" gap={0} height="14px" left="-8px" p={0} position="absolute" style={{"backgroundColor":"rgba(247, 241, 225, 1)"}} top="-8px" width="14px" />
              <Flex borderColor="color-mix(in srgb, currentColor 35%, transparent)" borderRadius="sm" borderStyle="solid" borderWidth="1px" data-name="fc1" gap={0} height="14px" p={0} position="absolute" right="-8px" style={{"backgroundColor":"rgba(247, 241, 225, 1)"}} top="-8px" width="14px" />
              <Flex borderColor="color-mix(in srgb, currentColor 35%, transparent)" borderRadius="sm" borderStyle="solid" borderWidth="1px" bottom="-8px" data-name="fc2" gap={0} height="14px" left="-8px" p={0} position="absolute" style={{"backgroundColor":"rgba(247, 241, 225, 1)"}} width="14px" />
              <Flex borderColor="color-mix(in srgb, currentColor 35%, transparent)" borderRadius="sm" borderStyle="solid" borderWidth="1px" bottom="-8px" data-name="fc3" gap={0} height="14px" p={0} position="absolute" right="-8px" style={{"backgroundColor":"rgba(247, 241, 225, 1)"}} width="14px" />
            </Grid>
          </Flex>
        </Flex>
        <Flex data-name="rule3" flexShrink="0" gap={0} height="1px" p={0} style={{"backgroundImage":"repeating-linear-gradient(to right, color-mix(in srgb, currentColor 32%, transparent) 0 16px, transparent 16px 32px)"}} width="100%" />
        <Flex alignItems="center" data-name="card" flexDirection="column" gap={3} maxWidth="1760px" my={1.5} overflow="hidden" px={6} style={{"backgroundColor":"rgba(240, 68, 44, 1)","backgroundImage":"radial-gradient(ellipse 55% 55% at 50% 114%, currentColor, transparent 70%), linear-gradient(115deg, transparent 45%, color-mix(in srgb, currentColor 65%, transparent) 100%), radial-gradient(color-mix(in srgb, currentColor 30%, transparent) 1px, transparent 1.5px)","backgroundSize":"auto, auto, 7px 7px","borderRadius":"28px","color":"#F2A900","paddingBottom":"200px","paddingTop":"152px"}} textAlign="center" width="100%">
          <Typography data-name="cardLabel" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" letterSpacing="0.14em" m={0} style={{"color":"#F7F1E1"}} variant="overline">The idea</Typography>
          <Typography data-name="cardTitle" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" letterSpacing="-0.05em" lineHeight="0.94" m={0} style={{"color":"#F7F1E1","fontSize":"120px","fontWeight":700}} variant="h1">Every theme. One class.</Typography>
          <Typography data-name="cardLead" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" lineHeight="1.5" m={0} maxWidth="620px" style={{"color":"#F7F1E1","fontSize":"21px"}} variant="body1">Your tokens become CSS variables, so switching a theme rewrites nothing and renders nothing.</Typography>
          <Flex data-name="cardActions" flexDirection="row" gap={1.5} justifyContent="center" p={0}>
            <Button color="primary" data-name="cb1" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize={2} px={3} size="lg" style={{"backgroundColor":"rgba(247, 241, 225, 1)","borderColor":"#F7F1E1","borderRadius":"999px","color":"#2F1702","letterSpacing":"0px"}} textTransform="none" variant="contained">See how it works</Button>
            <Button color="primary" data-name="cb2" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize={2} px={3} size="lg" style={{"backgroundColor":"rgba(0, 0, 0, 0)","borderColor":"#F7F1E1","borderRadius":"999px","color":"#F7F1E1","letterSpacing":"0px"}} textTransform="none" variant="outlined">Read the benchmarks</Button>
          </Flex>
        </Flex>
        <Flex data-name="rule4" flexShrink="0" gap={0} height="1px" p={0} style={{"backgroundImage":"repeating-linear-gradient(to right, color-mix(in srgb, currentColor 32%, transparent) 0 16px, transparent 16px 32px)"}} width="100%" />
        <Flex data-name="body2" gap={0} maxWidth="1760px" pb={0} pt={0} style={{"backgroundImage":"radial-gradient(color-mix(in srgb, currentColor 26%, transparent) 1px, transparent 1.5px)","backgroundSize":"12px 12px","paddingLeft":"200px","paddingRight":"200px"}} width="100%">
          <Flex alignItems="center" data-name="content2" flexDirection="column" gap={6} px={6} style={{"backgroundColor":"rgba(247, 241, 225, 1)","backgroundImage":"repeating-linear-gradient(to bottom, color-mix(in srgb, currentColor 32%, transparent) 0 12px, transparent 12px 24px), repeating-linear-gradient(to bottom, color-mix(in srgb, currentColor 32%, transparent) 0 12px, transparent 12px 24px)","backgroundPosition":"left top, right top","backgroundRepeat":"no-repeat","backgroundSize":"1px 100%, 1px 100%","paddingBottom":"104px","paddingTop":"104px"}} width="100%">
            <Flex alignItems="center" data-name="cmpHead" flexDirection="column" gap={2} p={0} textAlign="center">
              <Typography data-name="cmpLabel" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" letterSpacing="0.14em" m={0} style={{"color":"#F0442C"}} variant="overline">Side by side</Typography>
              <Typography align="center" data-name="cmpTitle" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" letterSpacing="-0.05em" lineHeight="1.02" m={0} maxWidth="820px" style={{"fontSize":"56px","fontWeight":700}} variant="h2">What changes when the engine is UmberStyle</Typography>
            </Flex>
            <Grid borderColor="#2F170224" borderStyle="solid" borderWidth="1px" data-name="cmp" display="grid" gap={0} gridTemplateColumns="1fr 1.25fr 1.25fr" maxWidth="1160px" p={0} position="relative" width="100%">
              <Typography borderBottomStyle="solid" borderBottomWidth="1px" data-name="cmp00" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" letterSpacing="0.1em" m={0} px={3} py={2} style={{"borderBottomColor":"#2F170224","color":"#2F1702","fontSize":"13px"}} textTransform="uppercase" variant="subtitle2">{" "}</Typography>
              <Typography borderBottomStyle="solid" borderBottomWidth="1px" borderLeftStyle="solid" borderLeftWidth="1px" data-name="cmp01" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" letterSpacing="0.1em" m={0} px={3} py={2} style={{"backgroundColor":"rgba(255, 251, 240, 1)","borderBottomColor":"#2F170224","borderLeftColor":"#2F170224","color":"#F0442C","fontSize":"13px","fontWeight":600}} textTransform="uppercase" variant="subtitle2">UmberStyle</Typography>
              <Typography borderBottomStyle="solid" borderBottomWidth="1px" borderLeftStyle="solid" borderLeftWidth="1px" data-name="cmp02" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" letterSpacing="0.1em" m={0} px={3} py={2} style={{"borderBottomColor":"#2F170224","borderLeftColor":"#2F170224","color":"#6B5A45","fontSize":"13px"}} textTransform="uppercase" variant="subtitle2">A typical runtime engine</Typography>
              <Typography borderBottomStyle="solid" borderBottomWidth="1px" data-name="cmp10" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" m={0} px={3} py={2} style={{"borderBottomColor":"#2F170224","color":"#2F1702"}} variant="subtitle1">A theme switch</Typography>
              <Typography borderBottomStyle="solid" borderBottomWidth="1px" borderLeftStyle="solid" borderLeftWidth="1px" data-name="cmp11" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize={2} m={0} px={3} py={2} style={{"backgroundColor":"rgba(255, 251, 240, 1)","borderBottomColor":"#2F170224","borderLeftColor":"#2F170224","color":"#2F1702","fontWeight":600}} variant="body2">Variables change. No class is rewritten</Typography>
              <Typography borderBottomStyle="solid" borderBottomWidth="1px" borderLeftStyle="solid" borderLeftWidth="1px" data-name="cmp12" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" m={0} px={3} py={2} style={{"borderBottomColor":"#2F170224","borderLeftColor":"#2F170224","color":"#6B5A45"}} variant="body1">Every styled component renders again</Typography>
              <Typography borderBottomStyle="solid" borderBottomWidth="1px" data-name="cmp20" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" m={0} px={3} py={2} style={{"borderBottomColor":"#2F170224","color":"#2F1702"}} variant="subtitle1">Classes for a component</Typography>
              <Typography borderBottomStyle="solid" borderBottomWidth="1px" borderLeftStyle="solid" borderLeftWidth="1px" data-name="cmp21" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize={2} m={0} px={3} py={2} style={{"backgroundColor":"rgba(255, 251, 240, 1)","borderBottomColor":"#2F170224","borderLeftColor":"#2F170224","color":"#2F1702","fontWeight":600}} variant="body2">One, shared by every theme</Typography>
              <Typography borderBottomStyle="solid" borderBottomWidth="1px" borderLeftStyle="solid" borderLeftWidth="1px" data-name="cmp22" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" m={0} px={3} py={2} style={{"borderBottomColor":"#2F170224","borderLeftColor":"#2F170224","color":"#6B5A45"}} variant="body1">One for each theme</Typography>
              <Typography borderBottomStyle="solid" borderBottomWidth="1px" data-name="cmp30" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" m={0} px={3} py={2} style={{"borderBottomColor":"#2F170224","color":"#2F1702"}} variant="subtitle1">Server components</Typography>
              <Typography borderBottomStyle="solid" borderBottomWidth="1px" borderLeftStyle="solid" borderLeftWidth="1px" data-name="cmp31" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize={2} m={0} px={3} py={2} style={{"backgroundColor":"rgba(255, 251, 240, 1)","borderBottomColor":"#2F170224","borderLeftColor":"#2F170224","color":"#2F1702","fontWeight":600}} variant="body2">Supported, with no context</Typography>
              <Typography borderBottomStyle="solid" borderBottomWidth="1px" borderLeftStyle="solid" borderLeftWidth="1px" data-name="cmp32" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" m={0} px={3} py={2} style={{"borderBottomColor":"#2F170224","borderLeftColor":"#2F170224","color":"#6B5A45"}} variant="body1">Needs a client boundary</Typography>
              <Typography borderBottomStyle="solid" borderBottomWidth="1px" data-name="cmp40" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" m={0} px={3} py={2} style={{"borderBottomColor":"#2F170224","color":"#2F1702"}} variant="subtitle1">React Native</Typography>
              <Typography borderBottomStyle="solid" borderBottomWidth="1px" borderLeftStyle="solid" borderLeftWidth="1px" data-name="cmp41" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize={2} m={0} px={3} py={2} style={{"backgroundColor":"rgba(255, 251, 240, 1)","borderBottomColor":"#2F170224","borderLeftColor":"#2F170224","color":"#2F1702","fontWeight":600}} variant="body2">The same component source</Typography>
              <Typography borderBottomStyle="solid" borderBottomWidth="1px" borderLeftStyle="solid" borderLeftWidth="1px" data-name="cmp42" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" m={0} px={3} py={2} style={{"borderBottomColor":"#2F170224","borderLeftColor":"#2F170224","color":"#6B5A45"}} variant="body1">A second code base</Typography>
              <Typography data-name="cmp50" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" m={0} px={3} py={2} style={{"color":"#2F1702"}} variant="subtitle1">The style prop</Typography>
              <Typography borderLeftStyle="solid" borderLeftWidth="1px" data-name="cmp51" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize={2} m={0} px={3} py={2} style={{"backgroundColor":"rgba(255, 251, 240, 1)","borderLeftColor":"#2F170224","color":"#2F1702","fontWeight":600}} variant="body2">A counted class, no attribute</Typography>
              <Typography borderLeftStyle="solid" borderLeftWidth="1px" data-name="cmp52" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" m={0} px={3} py={2} style={{"borderLeftColor":"#2F170224","color":"#6B5A45"}} variant="body1">An inline style attribute</Typography>
            </Grid>
          </Flex>
        </Flex>
        <Flex alignItems="center" data-name="wallSec" flexDirection="column" gap={0} maxWidth="1760px" pb={0} pl={0} pr={0} style={{"paddingTop":"120px"}} width="100%">
          <Flex alignItems="center" data-name="wallHead" flexDirection="column" gap={3} p={0} pb={8} textAlign="center">
            <Typography data-name="wallLabel" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" letterSpacing="0.14em" m={0} style={{"color":"#F0442C"}} variant="overline">Named for an earth pigment</Typography>
            <Typography align="center" data-name="wallTitle" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" letterSpacing="-0.055em" lineHeight="0.92" m={0} style={{"fontSize":"128px","fontWeight":700}} variant="h1">Your palette is the API.</Typography>
            <Typography align="center" data-name="wallLead" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" lineHeight="1.5" m={0} maxWidth="680px" style={{"color":"#6B5A45","fontSize":"21px"}} variant="body1">Give UmberStyle a theme and every value becomes a CSS variable that your classes point at. Change the pigment, keep the class.</Typography>
            <Flex data-name="wallActions" flexDirection="row" gap={1.5} justifyContent="center" p={0}>
              <Button borderRadius="md" color="primary" data-name="wb1" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize={2} size="lg" style={{"backgroundColor":"rgba(47, 23, 2, 1)","borderColor":"#2F1702","boxShadow":"0 6px 0 color-mix(in srgb, currentColor 18%, transparent)","color":"#F7F1E1","letterSpacing":"0px"}} textTransform="none" variant="contained">Read the theme docs</Button>
              <Button borderRadius="md" color="primary" data-name="wb2" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize={2} size="lg" style={{"backgroundColor":"rgba(255, 251, 240, 1)","borderColor":"#2F1702","color":"#2F1702","letterSpacing":"0px"}} textTransform="none" variant="outlined">See the tokens</Button>
            </Flex>
          </Flex>
          <Grid alignItems="end" data-name="wall" display="grid" gap={2} gridTemplateColumns="repeat(6, 1fr)" p={0} px={3} width="100%">
            <Flex borderRadius="24px 24px 0 0" data-name="sw1" flexDirection="column" gap={0.5} height="calc(460px - 0px)" justifyContent="flex-end" p={3} style={{"backgroundColor":"rgba(47, 23, 2, 1)","backgroundImage":"linear-gradient(to bottom, color-mix(in srgb, currentColor 22%, transparent), transparent 55%)","color":"#F7F1E1"}}>
              <Typography data-name="sw1n" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize={5} letterSpacing="-0.03em" m={0} style={{"color":"#F7F1E1","fontWeight":700}} textTransform="none" variant="overline">Umber</Typography>
              <Typography data-name="sw1v" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} overflow="hidden" style={{"color":"#F7F1E1","fontSize":"13px"}} textOverflow="ellipsis" variant="body2" whiteSpace="nowrap">--umber-palette-primary</Typography>
              <Typography data-name="sw1x" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} opacity={0.7} style={{"color":"#F7F1E1"}} variant="caption">palette.primary</Typography>
            </Flex>
            <Flex borderRadius="24px 24px 0 0" data-name="sw2" flexDirection="column" gap={0.5} height="calc(460px - 64px)" justifyContent="flex-end" p={3} style={{"backgroundColor":"rgba(240, 68, 44, 1)","backgroundImage":"linear-gradient(to bottom, color-mix(in srgb, currentColor 22%, transparent), transparent 55%)","color":"#F7F1E1"}}>
              <Typography data-name="sw2n" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize={5} letterSpacing="-0.03em" m={0} style={{"color":"#F7F1E1","fontWeight":700}} textTransform="none" variant="overline">Vermilion</Typography>
              <Typography data-name="sw2v" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} overflow="hidden" style={{"color":"#F7F1E1","fontSize":"13px"}} textOverflow="ellipsis" variant="body2" whiteSpace="nowrap">--umber-palette-accent</Typography>
              <Typography data-name="sw2x" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} opacity={0.7} style={{"color":"#F7F1E1"}} variant="caption">palette.accent</Typography>
            </Flex>
            <Flex borderRadius="24px 24px 0 0" data-name="sw3" flexDirection="column" gap={0.5} height="calc(460px - 24px)" justifyContent="flex-end" p={3} style={{"backgroundColor":"rgba(242, 169, 0, 1)","backgroundImage":"linear-gradient(to bottom, color-mix(in srgb, currentColor 22%, transparent), transparent 55%)","color":"#2F1702"}}>
              <Typography data-name="sw3n" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize={5} letterSpacing="-0.03em" m={0} style={{"color":"#2F1702","fontWeight":700}} textTransform="none" variant="overline">Ochre</Typography>
              <Typography data-name="sw3v" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} overflow="hidden" style={{"color":"#2F1702","fontSize":"13px"}} textOverflow="ellipsis" variant="body2" whiteSpace="nowrap">--umber-palette-warning</Typography>
              <Typography data-name="sw3x" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} opacity={0.7} style={{"color":"#2F1702"}} variant="caption">palette.warning</Typography>
            </Flex>
            <Flex borderRadius="24px 24px 0 0" data-name="sw4" flexDirection="column" gap={0.5} height="calc(460px - 88px)" justifyContent="flex-end" p={3} style={{"backgroundColor":"rgba(18, 161, 80, 1)","backgroundImage":"linear-gradient(to bottom, color-mix(in srgb, currentColor 22%, transparent), transparent 55%)","color":"#F7F1E1"}}>
              <Typography data-name="sw4n" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize={5} letterSpacing="-0.03em" m={0} style={{"color":"#F7F1E1","fontWeight":700}} textTransform="none" variant="overline">Malachite</Typography>
              <Typography data-name="sw4v" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} overflow="hidden" style={{"color":"#F7F1E1","fontSize":"13px"}} textOverflow="ellipsis" variant="body2" whiteSpace="nowrap">--umber-palette-success</Typography>
              <Typography data-name="sw4x" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} opacity={0.7} style={{"color":"#F7F1E1"}} variant="caption">palette.success</Typography>
            </Flex>
            <Flex borderRadius="24px 24px 0 0" data-name="sw5" flexDirection="column" gap={0.5} height="calc(460px - 40px)" justifyContent="flex-end" p={3} style={{"backgroundColor":"rgba(47, 91, 234, 1)","backgroundImage":"linear-gradient(to bottom, color-mix(in srgb, currentColor 22%, transparent), transparent 55%)","color":"#F7F1E1"}}>
              <Typography data-name="sw5n" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize={5} letterSpacing="-0.03em" m={0} style={{"color":"#F7F1E1","fontWeight":700}} textTransform="none" variant="overline">Lapis</Typography>
              <Typography data-name="sw5v" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} overflow="hidden" style={{"color":"#F7F1E1","fontSize":"13px"}} textOverflow="ellipsis" variant="body2" whiteSpace="nowrap">--umber-palette-info</Typography>
              <Typography data-name="sw5x" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} opacity={0.7} style={{"color":"#F7F1E1"}} variant="caption">palette.info</Typography>
            </Flex>
            <Flex borderRadius="24px 24px 0 0" data-name="sw6" flexDirection="column" gap={0.5} height="calc(460px - 8px)" justifyContent="flex-end" p={3} style={{"backgroundColor":"rgba(224, 69, 123, 1)","backgroundImage":"linear-gradient(to bottom, color-mix(in srgb, currentColor 22%, transparent), transparent 55%)","color":"#F7F1E1"}}>
              <Typography data-name="sw6n" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" fontSize={5} letterSpacing="-0.03em" m={0} style={{"color":"#F7F1E1","fontWeight":700}} textTransform="none" variant="overline">Madder</Typography>
              <Typography data-name="sw6v" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} overflow="hidden" style={{"color":"#F7F1E1","fontSize":"13px"}} textOverflow="ellipsis" variant="body2" whiteSpace="nowrap">--umber-palette-error</Typography>
              <Typography data-name="sw6x" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} opacity={0.7} style={{"color":"#F7F1E1"}} variant="caption">palette.error</Typography>
            </Flex>
          </Grid>
        </Flex>
        <Flex alignItems="center" data-name="footer" flexDirection="column" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" gap={0} overflow="hidden" p={0} style={{"backgroundColor":"rgba(47, 23, 2, 1)","backgroundImage":"linear-gradient(to right, color-mix(in srgb, currentColor 7%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, currentColor 7%, transparent) 1px, transparent 1px), linear-gradient(to right, color-mix(in srgb, currentColor 5%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, currentColor 5%, transparent) 1px, transparent 1px)","backgroundSize":"160px 160px, 160px 160px, 32px 32px, 32px 32px","color":"#F7F1E1"}} width="100%">
          <Flex alignItems="center" data-name="footTop" flexDirection="row" gap={8} maxWidth="1760px" px={6} style={{"paddingBottom":"88px","paddingTop":"104px"}} width="100%">
            <Grid data-name="menu" display="grid" flex="7 1 0" gap={4} gridTemplateColumns="repeat(4, 1fr)" minWidth="0" p={0}>
              <Flex alignItems="flex-start" data-name="m1" flexDirection="column" gap={1.5} p={0}>
                <Typography data-name="m1t" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" letterSpacing="0.1em" mb={1} mt={0} mx={0} style={{"color":"#F2A900"}} variant="overline">Sheet 1 / Docs</Typography>
                <Link as="a" color="inherit" data-name="m1l0" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" href="#" style={{"color":"#F7F1E1"}} underline="hover" variant="body1">Getting started</Link>
                <Link as="a" color="inherit" data-name="m1l1" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" href="#" style={{"color":"#F7F1E1"}} underline="hover" variant="body1">Writing styles</Link>
                <Link as="a" color="inherit" data-name="m1l2" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" href="#" style={{"color":"#F7F1E1"}} underline="hover" variant="body1">Themes and tokens</Link>
                <Link as="a" color="inherit" data-name="m1l3" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" href="#" style={{"color":"#F7F1E1"}} underline="hover" variant="body1">Server rendering</Link>
              </Flex>
              <Flex alignItems="flex-start" data-name="m2" flexDirection="column" gap={1.5} p={0}>
                <Typography data-name="m2t" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" letterSpacing="0.1em" mb={1} mt={0} mx={0} style={{"color":"#F2A900"}} variant="overline">Sheet 2 / Packages</Typography>
                <Link as="a" color="inherit" data-name="m2l0" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" href="#" style={{"color":"#F7F1E1"}} underline="hover" variant="body1">@umber-style/react</Link>
                <Link as="a" color="inherit" data-name="m2l1" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" href="#" style={{"color":"#F7F1E1"}} underline="hover" variant="body1">@umber-style/vue</Link>
                <Link as="a" color="inherit" data-name="m2l2" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" href="#" style={{"color":"#F7F1E1"}} underline="hover" variant="body1">@umber-style/react-native</Link>
                <Link as="a" color="inherit" data-name="m2l3" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" href="#" style={{"color":"#F7F1E1"}} underline="hover" variant="body1">@umber-style/css</Link>
              </Flex>
              <Flex alignItems="flex-start" data-name="m3" flexDirection="column" gap={1.5} p={0}>
                <Typography data-name="m3t" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" letterSpacing="0.1em" mb={1} mt={0} mx={0} style={{"color":"#F2A900"}} variant="overline">Sheet 3 / Project</Typography>
                <Link as="a" color="inherit" data-name="m3l0" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" href="#" style={{"color":"#F7F1E1"}} underline="hover" variant="body1">GitHub</Link>
                <Link as="a" color="inherit" data-name="m3l1" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" href="#" style={{"color":"#F7F1E1"}} underline="hover" variant="body1">Releases</Link>
                <Link as="a" color="inherit" data-name="m3l2" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" href="#" style={{"color":"#F7F1E1"}} underline="hover" variant="body1">Benchmarks</Link>
                <Link as="a" color="inherit" data-name="m3l3" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" href="#" style={{"color":"#F7F1E1"}} underline="hover" variant="body1">Roadmap</Link>
              </Flex>
              <Flex alignItems="flex-start" data-name="m4" flexDirection="column" gap={1.5} p={0}>
                <Typography data-name="m4t" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" letterSpacing="0.1em" mb={1} mt={0} mx={0} style={{"color":"#F2A900"}} variant="overline">Sheet 4 / Guides</Typography>
                <Link as="a" color="inherit" data-name="m4l0" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" href="#" style={{"color":"#F7F1E1"}} underline="hover" variant="body1">Moving an app over</Link>
                <Link as="a" color="inherit" data-name="m4l1" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" href="#" style={{"color":"#F7F1E1"}} underline="hover" variant="body1">Typed styles</Link>
                <Link as="a" color="inherit" data-name="m4l2" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" href="#" style={{"color":"#F7F1E1"}} underline="hover" variant="body1">Cascade layers</Link>
                <Link as="a" color="inherit" data-name="m4l3" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" href="#" style={{"color":"#F7F1E1"}} underline="hover" variant="body1">Testing</Link>
              </Flex>
            </Grid>
            <Flex borderColor="color-mix(in srgb, currentColor 40%, transparent)" borderStyle="dashed" borderWidth="1px" data-name="footArt" flex="5 1 0" gap={0} minHeight="400px" minWidth="0" p={0} position="relative">
              <Image alt="blueprint" height="100%" left="0" objectFit="contain" position="absolute" src="/10b7f8e20e2a3be4b1434c97596bf05ad0ff26fefed6c274dc46953a76d836b4.svg" top="0" width="100%" />
            </Flex>
          </Flex>
          <Grid borderBottomStyle="solid" borderBottomWidth="1px" borderTopStyle="solid" borderTopWidth="1px" data-name="specs" display="grid" gap={0} gridTemplateColumns="repeat(4, 1fr)" maxWidth="1760px" p={0} style={{"borderBottomColor":"color-mix(in srgb, currentColor 30%, transparent)","borderTopColor":"color-mix(in srgb, currentColor 30%, transparent)"}} width="100%">
            <Flex borderLeftStyle="dashed" borderLeftWidth="0" data-name="sp1" flexDirection="column" gap={0.75} p={3} style={{"borderLeftColor":"color-mix(in srgb, currentColor 35%, transparent)"}}>
              <Typography data-name="sp1l" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} style={{"color":"#F2A900"}} variant="overline">Sheet A / tokens</Typography>
              <Typography data-name="sp1v" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} style={{"color":"#F7F1E1","fontSize":"15px"}} variant="body2">{"theme -> CSS variables"}</Typography>
            </Flex>
            <Flex borderLeftStyle="dashed" borderLeftWidth="1px" data-name="sp2" flexDirection="column" gap={0.75} p={3} style={{"borderLeftColor":"color-mix(in srgb, currentColor 35%, transparent)"}}>
              <Typography data-name="sp2l" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} style={{"color":"#F2A900"}} variant="overline">Sheet B / classes</Typography>
              <Typography data-name="sp2v" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} style={{"color":"#F7F1E1","fontSize":"15px"}} variant="body2">one per component</Typography>
            </Flex>
            <Flex borderLeftStyle="dashed" borderLeftWidth="1px" data-name="sp3" flexDirection="column" gap={0.75} p={3} style={{"borderLeftColor":"color-mix(in srgb, currentColor 35%, transparent)"}}>
              <Typography data-name="sp3l" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} style={{"color":"#F2A900"}} variant="overline">Sheet C / targets</Typography>
              <Typography data-name="sp3v" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} style={{"color":"#F7F1E1","fontSize":"15px"}} variant="body2">React, Vue, React Native</Typography>
            </Flex>
            <Flex borderLeftStyle="dashed" borderLeftWidth="1px" data-name="sp4" flexDirection="column" gap={0.75} p={3} style={{"borderLeftColor":"color-mix(in srgb, currentColor 35%, transparent)"}}>
              <Typography data-name="sp4l" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} style={{"color":"#F2A900"}} variant="overline">Sheet D / tolerance</Typography>
              <Typography data-name="sp4v" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} style={{"color":"#F7F1E1","fontSize":"15px"}} variant="body2">100% test coverage</Typography>
            </Flex>
          </Grid>
          <Typography data-name="wordmark" fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif" letterSpacing="-0.05em" lineHeight="0.9" mt={6} mx={0} opacity={0.55} style={{"WebkitTextStrokeColor":"#F7F1E1","WebkitTextStrokeWidth":"1.5px","color":"transparent","fontSize":"330px","fontWeight":700,"marginBottom":"-36px"}} variant="h1" whiteSpace="nowrap">UmberStyle</Typography>
          <Flex borderTopStyle="solid" borderTopWidth="1px" data-name="footLine" flexDirection="row" gap={0} justifyContent="space-between" maxWidth="1760px" p={0} px={6} py={3} style={{"backgroundColor":"rgba(47, 23, 2, 1)","borderTopColor":"color-mix(in srgb, currentColor 30%, transparent)"}} width="100%">
            <Typography data-name="footCopy" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} style={{"color":"#F7F1E1"}} variant="caption">UmberStyle / MIT licensed</Typography>
            <Typography data-name="footRev" fontFamily="'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" m={0} opacity={0.6} style={{"color":"#F7F1E1"}} variant="caption">SCALE 1:1 / REV 0.1 ALPHA</Typography>
          </Flex>
        </Flex>
      </Flex>
    </main>
  )
}
