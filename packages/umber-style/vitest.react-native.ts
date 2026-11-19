import { vi } from 'vitest'

// A stand-in for the platform StyleSheet: `create` records its input and returns it.
// A stand-in for the platform Appearance: the color scheme is whatever a test sets.
export const Appearance = {
  getColorScheme: vi.fn((): 'light' | 'dark' | null | undefined => 'light'),
}

export const StyleSheet = {
  create: vi.fn(<T>(styles: T) => styles),
  flatten: vi.fn((style: unknown) => style),
  compose: vi.fn((first: unknown, second: unknown) => [first, second]),
  hairlineWidth: 1,
  absoluteFill: { position: 'absolute' },
  absoluteFillObject: { position: 'absolute' },
}
