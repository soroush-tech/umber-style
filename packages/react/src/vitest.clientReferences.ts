// The setup of the server tests. A bundler of server components does not run a `'use client'` module
// that a server file imports: the import gives a reference to the component, which React sends to the
// browser. The tests of the server build see the same, a reference that `resolveTree` does not call.
vi.mock('./GlobalRelease', () => ({
  GlobalRelease: { $$typeof: Symbol.for('react.client.reference'), $$id: 'GlobalRelease' },
}))
vi.mock('./ProviderScope', () => ({
  ProviderScope: { $$typeof: Symbol.for('react.client.reference'), $$id: 'ProviderScope' },
}))
