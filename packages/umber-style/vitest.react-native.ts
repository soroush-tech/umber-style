import { vi } from 'vitest'

// A stand-in for the platform StyleSheet: `create` records its input and returns it.
export const StyleSheet = {
  create: vi.fn(<T>(styles: T) => styles),
  flatten: vi.fn((style: unknown) => style),
  compose: vi.fn((first: unknown, second: unknown) => [first, second]),
  hairlineWidth: 1,
  absoluteFill: { position: 'absolute' },
  absoluteFillObject: { position: 'absolute' },
}
