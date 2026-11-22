import { vi } from 'vitest'

// A stand-in for the platform StyleSheet: `create` records its input and returns it.
// A stand-in for the platform Appearance: the color scheme is whatever a test sets.
export const Appearance = {
  getColorScheme: vi.fn((): 'light' | 'dark' | null | undefined => 'light'),
  addChangeListener: vi.fn(() => ({ remove: () => {} })),
}

// Stand-ins for the platform Dimensions and AccessibilityInfo: a window of 400 by 800 that never
// changes, and reduced motion off.
export const Dimensions = {
  get: vi.fn((_dimension: string) => ({ width: 400, height: 800, scale: 1, fontScale: 1 })),
  addEventListener: vi.fn(() => ({ remove: () => {} })),
}

export const AccessibilityInfo = {
  isReduceMotionEnabled: vi.fn(() => Promise.resolve(false)),
  addEventListener: vi.fn(() => ({ remove: () => {} })),
}

export const StyleSheet = {
  create: vi.fn(<T>(styles: T) => styles),
  flatten: vi.fn((style: unknown) => style),
  compose: vi.fn((first: unknown, second: unknown) => [first, second]),
  hairlineWidth: 1,
  absoluteFill: { position: 'absolute' },
  absoluteFillObject: { position: 'absolute' },
}
