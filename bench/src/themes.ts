// Theme builders for the benchmarks. Both are plain data, built the same way on every run, so two runs
// measure the same input. The small theme has about 20 tokens, the large one about 300.

/** The shape of the small theme (about 20 tokens), with `breakpoints` that are real values. */
export interface SmallTheme {
  palette: Record<'primary' | 'secondary' | 'text' | 'background' | 'border' | 'danger', string>
  space: number[]
  radii: Record<'sm' | 'md' | 'lg', number>
  fontSizes: Record<'sm' | 'md' | 'lg', number>
  typography: Record<'body' | 'heading', string>
  breakpoints: string[]
}

/** The shape of the large theme (about 300 tokens). */
export interface LargeTheme {
  palette: Record<string, string>
  space: number[]
  sizes: Record<string, number>
  radii: Record<string, number>
  fontSizes: Record<string, number>
  fontWeights: Record<string, number>
  lineHeights: Record<string, number>
  letterSpacings: Record<string, string>
  typography: Record<string, string>
  shadows: Record<string, string>
  zIndices: Record<string, number>
  borderWidths: Record<string, number>
  durations: Record<string, string>
  easings: Record<string, string>
  opacities: Record<string, number>
  breakpoints: string[]
}

/** A colour from an index: the same index always gives the same colour. */
export function createColor(index: number): string {
  const value = (index * 2654435761) % 0x1000000
  return `#${value.toString(16).padStart(6, '0')}`
}

/** The small theme: 6 colours, 6 spaces, 3 radii, 3 font sizes, 2 font stacks, and 2 breakpoints. */
export function createSmallTheme(): SmallTheme {
  return {
    palette: {
      primary: '#1b5fd1',
      secondary: '#6b4fbb',
      text: '#1a1a1a',
      background: '#ffffff',
      border: '#d0d0d0',
      danger: '#c62828',
    },
    space: [0, 4, 8, 12, 16, 24],
    radii: { sm: 2, md: 4, lg: 8 },
    fontSizes: { sm: 12, md: 14, lg: 18 },
    typography: { body: 'system-ui, sans-serif', heading: 'Georgia, serif' },
    breakpoints: ['40em', '64em'],
  }
}

const HUES = [
  'gray',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'pink',
  'brown',
]

/** `count` entries named `<prefix><index>`, each from `make`. */
function createScale<V>(prefix: string, count: number, make: (index: number) => V) {
  return Object.fromEntries(Array.from({ length: count }, (_, i) => [`${prefix}${i}`, make(i)]))
}

/** The large theme: about 280 tokens across colours, spaces, sizes, radii, type, shadows, motion and more. */
export function createLargeTheme(): LargeTheme {
  let seed = 0
  const palette: Record<string, string> = {}
  for (const hue of HUES) {
    for (let shade = 1; shade <= 10; shade++) palette[`${hue}${shade}00`] = createColor(seed++)
  }
  for (const name of ['text', 'muted', 'background', 'surface', 'border', 'primary', 'danger']) {
    palette[name] = createColor(seed++)
  }
  return {
    palette,
    space: Array.from({ length: 24 }, (_, i) => i * 4),
    sizes: createScale('s', 20, (i) => 16 * (i + 1)),
    radii: createScale('r', 12, (i) => i * 2),
    fontSizes: createScale('f', 16, (i) => 10 + i * 2),
    fontWeights: createScale('w', 9, (i) => 100 * (i + 1)),
    lineHeights: createScale('l', 8, (i) => 1 + i * 0.1),
    letterSpacings: createScale('t', 6, (i) => `${i * 0.01}em`),
    typography: createScale('font', 6, (i) => `Family${i}, system-ui, sans-serif`),
    shadows: createScale('shadow', 12, (i) => `0 ${i}px ${i * 2}px rgba(0, 0, 0, 0.${i + 1})`),
    zIndices: createScale('z', 10, (i) => i * 100),
    borderWidths: createScale('b', 6, (i) => i),
    durations: createScale('d', 8, (i) => `${(i + 1) * 50}ms`),
    easings: createScale('e', 6, (i) => `cubic-bezier(0.${i}, 0, 0.${i + 2}, 1)`),
    opacities: createScale('o', 11, (i) => i / 10),
    breakpoints: ['30em', '40em', '52em', '64em', '80em'],
  }
}

/** How many tokens `theme` has: its leaves, without the real-value key `breakpoints`. */
export function countTokens(theme: object): number {
  let count = 0
  const walk = (value: unknown, isRoot: boolean) => {
    for (const [key, child] of Object.entries(value as object)) {
      if (isRoot && key === 'breakpoints') continue
      if (typeof child === 'object' && child !== null) walk(child, false)
      else count++
    }
  }
  walk(theme, true)
  return count
}

/** A copy of `theme` that is a different object with the same values: a theme the engine has not seen. */
export function cloneTheme<T extends object>(theme: T): T {
  return structuredClone(theme)
}
