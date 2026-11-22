import { useId, useState, type KeyboardEvent } from 'react'
import { Flex } from '@soroush.tech/design-system/Flex'
import { Typography } from '@soroush.tech/design-system/Typography'

/** The platforms the hero shows a sample for. */
export type CodeTab = 'react' | 'vue' | 'native' | 'server'

/** The props of `CodeTabs`. */
export interface CodeTabsProps {
  /** The tab that is selected at first. */
  defaultTab?: CodeTab
}

/** One sample: the label of its tab, the file name on the card, and its nine lines of code. */
interface Sample {
  readonly label: string
  readonly file: string
  readonly lines: readonly string[]
}

const SANS = "'Space Grotesk Variable', 'Space Grotesk', sans-serif"
const MONO =
  "'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace"

/** The colours of the card, as the page's own boxes have them. */
const CREAM = '#F7F1E1'
const INK = '#2F1702'

const styleLines = (base: string, background: string) => [
  `const Card = styled(${base})(({ theme }) => ({`,
  '  padding: theme.space[3],',
  '  color: theme.palette.text,',
  `  ${background}: theme.palette.surface,`,
  '}))',
  '',
]

/** Every sample is nine lines, so the card keeps its height from tab to tab. */
const SAMPLES: Readonly<Record<CodeTab, Sample>> = {
  react: {
    label: 'React',
    file: 'Card.tsx',
    lines: [
      ...styleLines("'div'", 'background'),
      '<ThemeProvider theme={dark}>',
      '  <Card />',
      '</ThemeProvider>',
    ],
  },
  vue: {
    label: 'Vue',
    file: 'Card.ts',
    lines: [
      ...styleLines("'div'", 'background'),
      '<ThemeProvider :theme="dark">',
      '  <Card />',
      '</ThemeProvider>',
    ],
  },
  native: {
    label: 'React Native',
    file: 'Card.native.tsx',
    lines: [
      ...styleLines('View', 'backgroundColor'),
      '<ThemeProvider theme={dark}>',
      '  <Card />',
      '</ThemeProvider>',
    ],
  },
  server: {
    label: 'Server',
    file: 'page.tsx',
    lines: [
      ...styleLines("'div'", 'background'),
      'export default async function Page() {',
      '  return <Card>{await loadText()}</Card>',
      '}',
    ],
  },
}

const TABS = Object.keys(SAMPLES) as CodeTab[]

/**
 * The hero's code card: a tab for each platform, and under it the same component written for that
 * platform. Its boxes are the ones the page drew by hand before the tabs worked, so the two look
 * the same. The arrow keys move between the tabs, as in any tab list.
 */
export function CodeTabs({ defaultTab = 'react' }: CodeTabsProps) {
  const [selected, setSelected] = useState<CodeTab>(defaultTab)
  const baseId = useId()
  const sample = SAMPLES[selected]

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (step === undefined) return
    event.preventDefault()
    const next = TABS[(TABS.indexOf(selected) + step + TABS.length) % TABS.length]
    setSelected(next)
    document.getElementById(`${baseId}-tab-${next}`)?.focus()
  }

  return (
    <>
      <Flex
        role="tablist"
        aria-label="Platform"
        onKeyDown={handleKeyDown}
        alignSelf="flex-start"
        data-name="tabs"
        flexDirection="row"
        gap={0.5}
        p={0.5}
        style={{ backgroundColor: 'rgba(255, 251, 240, 1)', borderRadius: '12px' }}
      >
        {TABS.map((tab) => {
          const isSelected = tab === selected
          return (
            <Typography
              key={tab}
              id={`${baseId}-tab-${tab}`}
              role="tab"
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setSelected(tab)}
              borderRadius="md"
              fontFamily={SANS}
              m={0}
              px={2}
              py={1}
              style={
                isSelected
                  ? {
                      backgroundColor: 'rgba(47, 23, 2, 1)',
                      color: CREAM,
                      cursor: 'pointer',
                      fontSize: '15px',
                      fontWeight: 600,
                    }
                  : { color: INK, cursor: 'pointer', fontSize: '15px' }
              }
              variant="body2"
            >
              {SAMPLES[tab].label}
            </Typography>
          )
        })}
      </Flex>
      <Flex
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${selected}`}
        borderRadius="lg"
        data-name="window"
        flexDirection="column"
        gap={0}
        overflow="hidden"
        p={0}
        style={{ backgroundColor: 'rgba(26, 13, 1, 1)', color: CREAM }}
      >
        <Typography
          borderBottomStyle="dashed"
          fontFamily={MONO}
          m={0}
          opacity={0.7}
          px={3}
          py={1.5}
          style={{
            borderBottomColor: 'color-mix(in srgb, currentColor 35%, transparent)',
            borderBottomWidth: '1px',
            color: CREAM,
          }}
          variant="caption"
        >
          {sample.file}
        </Typography>
        <Flex flexDirection="column" gap={0} p={3}>
          {sample.lines.map((line, index) => (
            <Typography
              // The lines of one sample never reorder; the index and the tab name them.
              key={`${selected}-${index}`}
              fontFamily={MONO}
              m={0}
              minHeight="27px"
              style={{ color: CREAM, fontSize: '15px', fontVariantLigatures: 'none', lineHeight: 1.8 }}
              variant="body2"
              whiteSpace="pre"
            >
              {line === '' ? ' ' : line}
            </Typography>
          ))}
        </Flex>
      </Flex>
    </>
  )
}
