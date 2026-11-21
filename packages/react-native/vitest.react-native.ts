import { vi } from 'vitest'

type Handler = (...args: never[]) => void

/** The handlers of one stand-in event source, by event name, and a subscription that removes one. */
function createEvents() {
  const handlers = new Map<string, Set<Handler>>()
  const add = (name: string, handler: Handler) => {
    const set = handlers.get(name) ?? new Set()
    handlers.set(name, set)
    set.add(handler)
    return { remove: () => set.delete(handler) }
  }
  const emit = (name: string, ...args: never[]) => {
    for (const handler of handlers.get(name) ?? []) handler(...args)
  }
  const count = () => [...handlers.values()].reduce((total, set) => total + set.size, 0)
  return { add, emit, count }
}

const appearanceEvents = createEvents()
const dimensionEvents = createEvents()
const accessibilityEvents = createEvents()

// A stand-in for the platform StyleSheet: `create` records its input and returns it.
// A stand-in for the platform Appearance: the color scheme is whatever a test sets.
export const Appearance = {
  getColorScheme: vi.fn((): 'light' | 'dark' | null | undefined => 'light'),
  addChangeListener: vi.fn((handler: Handler) => appearanceEvents.add('change', handler)),
}

export const StyleSheet = {
  create: vi.fn(<T>(styles: T) => styles),
  flatten: vi.fn((style: unknown) => style),
  compose: vi.fn((first: unknown, second: unknown) => [first, second]),
  hairlineWidth: 1,
  absoluteFill: { position: 'absolute' },
  absoluteFillObject: { position: 'absolute' },
}

// A stand-in for the platform Dimensions: the window is 400 by 800 until a test sets another size.
const size = { width: 400, height: 800 }
export const Dimensions = {
  get: vi.fn((_dimension: string) => ({ ...size, scale: 1, fontScale: 1 })),
  addEventListener: vi.fn((name: string, handler: Handler) => dimensionEvents.add(name, handler)),
}

// A stand-in for the platform AccessibilityInfo: reduced motion is off until a test sets it.
export const AccessibilityInfo = {
  isReduceMotionEnabled: vi.fn(() => Promise.resolve(false)),
  addEventListener: vi.fn((name: string, handler: Handler) =>
    accessibilityEvents.add(name, handler)
  ),
}

/** What the tests do to the stand-ins: what a user or the system would do on a device. */
export const platform = {
  /** Resizes (or rotates) the window and tells the listeners, as the platform does. */
  resize(width: number, height: number) {
    Object.assign(size, { width, height })
    dimensionEvents.emit('change')
  },
  /** Changes the system color scheme and tells the listeners. */
  setColorScheme(scheme: 'light' | 'dark' | null) {
    Appearance.getColorScheme.mockReturnValue(scheme)
    appearanceEvents.emit('change')
  },
  /** Turns reduced motion on or off in the system settings, which the platform reports as an event. */
  setReducedMotion(isEnabled: boolean) {
    accessibilityEvents.emit('reduceMotionChanged', isEnabled as never)
  },
  /** How many handlers the binding has on the platform's events now. */
  countListeners() {
    return appearanceEvents.count() + dimensionEvents.count() + accessibilityEvents.count()
  },
}
