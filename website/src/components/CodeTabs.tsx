import { useId, useState, type KeyboardEvent } from 'react'
import { Button } from '@soroush.tech/design-system/Button'
import { Flex } from '@soroush.tech/design-system/Flex'
import { useTheme } from '@soroush.tech/design-system/theme'
import { Typography } from '@soroush.tech/design-system/Typography'

/** The platforms the hero shows a sample for. */
export type CodeTab = 'react' | 'vue' | 'native'

/** The props of `CodeTabs`. */
export interface CodeTabsProps {
  /** The tab that is selected at first. */
  defaultTab?: CodeTab
}

/** One sample: the label of its tab, the file name on the card, and the lines of code. */
interface Sample {
  readonly label: string
  readonly file: string
  readonly lines: readonly string[]
}

const STYLE_LINES = [
  '  padding: theme.space[3],',
  '  color: theme.palette.text,',
  '  backgroundColor: theme.palette.surface,',
  '}))',
] as const

const SAMPLES: Readonly<Record<CodeTab, Sample>> = {
  react: {
    label: 'React',
    file: 'Card.tsx',
    lines: [
      "import { styled, ThemeProvider } from '@umber-style/react'",
      '',
      "const Card = styled('div')(({ theme }) => ({",
      ...STYLE_LINES,
      '',
      '<ThemeProvider theme={dark}>',
      '  <Card />',
      '</ThemeProvider>',
    ],
  },
  vue: {
    label: 'Vue',
    file: 'Card.ts',
    lines: [
      "import { styled, ThemeProvider } from '@umber-style/vue'",
      '',
      "const Card = styled('div')(({ theme }) => ({",
      ...STYLE_LINES,
      '',
      '<ThemeProvider :theme="dark">',
      '  <Card />',
      '</ThemeProvider>',
    ],
  },
  native: {
    label: 'React Native',
    file: 'Card.native.tsx',
    lines: [
      "import { View } from 'react-native'",
      "import { styled, ThemeProvider } from '@umber-style/react-native'",
      '',
      'const Card = styled(View)(({ theme }) => ({',
      ...STYLE_LINES,
      '',
      '<ThemeProvider theme={dark}>',
      '  <Card />',
      '</ThemeProvider>',
    ],
  },
}

const TABS = Object.keys(SAMPLES) as CodeTab[]

/**
 * The hero's code card: a tab for each platform, and under it the same component written for that
 * platform. The arrow keys move between the tabs, as in any tab list.
 */
export function CodeTabs({ defaultTab = 'react' }: CodeTabsProps) {
  const [selected, setSelected] = useState<CodeTab>(defaultTab)
  const theme = useTheme()
  const baseId = useId()
  const sample = SAMPLES[selected]
  const onText = theme.palette.primary.contrastText

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (step === undefined) return
    event.preventDefault()
    const next = TABS[(TABS.indexOf(selected) + step + TABS.length) % TABS.length]
    setSelected(next)
    document.getElementById(`${baseId}-tab-${next}`)?.focus()
  }

  return (
    <Flex flexDirection="column" gap={3} data-name="CodeTabs">
      <Flex
        role="tablist"
        aria-label="Platform"
        onKeyDown={handleKeyDown}
        flexDirection="row"
        alignSelf="flex-start"
        gap={0.5}
        p={0.5}
        bg="paper"
        borderRadius="md"
      >
        {TABS.map((tab) => (
          <Button
            key={tab}
            id={`${baseId}-tab-${tab}`}
            role="tab"
            aria-selected={tab === selected}
            aria-controls={`${baseId}-panel`}
            tabIndex={tab === selected ? 0 : -1}
            variant={tab === selected ? 'contained' : 'text'}
            color="primary"
            size="sm"
            shape="rounded"
            textTransform="none"
            onClick={() => setSelected(tab)}
          >
            {SAMPLES[tab].label}
          </Button>
        ))}
      </Flex>
      <Flex
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${selected}`}
        flexDirection="column"
        bg="terminal"
        borderRadius="lg"
        overflow="hidden"
        style={{ color: onText }}
      >
        <Typography
          variant="caption"
          px={3}
          py={1.5}
          fontFamily={theme.fonts.mono}
          opacity={0.7}
          style={{ color: onText, borderBottom: `1px dashed ${onText}55` }}
        >
          {sample.file}
        </Typography>
        <Flex as="pre" flexDirection="column" p={3} m={0} minHeight="19em">
          {sample.lines.map((line, index) => (
            <Typography
              // The lines of one sample never reorder; the index and the tab name them.
              key={`${selected}-${index}`}
              as="code"
              variant="body2"
              fontFamily={theme.fonts.mono}
              lineHeight="loose"
              whiteSpace="pre"
              style={{ color: onText, fontVariantLigatures: 'none' }}
            >
              {line === '' ? ' ' : line}
            </Typography>
          ))}
        </Flex>
      </Flex>
    </Flex>
  )
}
