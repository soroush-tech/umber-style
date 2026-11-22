// A stand-in for the platform module, which Node cannot load: the built binding's `react-native` is
// sent here (`prepareBuiltPackages` in `fixtures.ts`). `StyleSheet.create` returns its input, as the
// stand-in of the tests does, but it is a plain function: it records nothing, so nothing grows with
// the operations. The colour scheme is light.
export const Appearance = {
  getColorScheme: (): 'light' | 'dark' | null | undefined => 'light',
}

export const StyleSheet = {
  create: <T>(styles: T): T => styles,
  flatten: (style: unknown) => style,
  compose: (first: unknown, second: unknown) => [first, second],
  hairlineWidth: 1,
  absoluteFill: { position: 'absolute' },
  absoluteFillObject: { position: 'absolute' },
}
