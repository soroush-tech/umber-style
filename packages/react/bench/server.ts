// What the files of the server components build load, in this order: the process is made to run
// built code under the `react-server` condition (`prepareBuiltPackages`: production React, the built
// core, and `react` resolved to its server build, where hooks do not exist), then React, the server
// build of the binding (`dist/index.server.cjs`, which the condition selects in an app) and the helper
// the server tests render with are loaded after it. A file imports this module before anything that
// loads React.
import type * as Core from '@umber-style/core'
import { createRequire } from 'node:module'
import type * as React from 'react'
import { prepareBuiltPackages } from '../../../bench/src/built'
import type * as ServerBinding from '../src/index.server'
import type { CacheFunction } from '../src/serverContext'
import type * as ResolveTree from '../src/vitest.resolveTree'
import { createFixtures, theme, type BenchStyle } from './fixtures'

prepareBuiltPackages({ conditions: ['react-server'] })
const load = createRequire(import.meta.url)

const core = load('../../core/dist/index.cjs') as typeof Core
// A bundler of server components does not run a `'use client'` module that a server file imports: the
// import is a reference to the component, which `resolveTree` leaves as it is (see
// `src/vitest.clientReferences.ts`). The modules are put in the require cache as references before the
// server build loads them, so that the work measured is that of a server.
for (const [file, name] of [
  ['../dist/ProviderScope.cjs', 'ProviderScope'],
  ['../dist/GlobalRelease.cjs', 'GlobalRelease'],
]) {
  const id = load.resolve(file)
  const reference = { $$typeof: Symbol.for('react.client.reference'), $$id: name }
  load.cache[id] = {
    id,
    filename: id,
    loaded: true,
    exports: { [name]: reference },
  } as NodeJS.Module
}
const { bindEngine } = load('../dist/index.server.cjs') as typeof ServerBinding
export const { resolveTree } = load('../src/vitest.resolveTree.ts') as typeof ResolveTree
export const fixtures = createFixtures(load('react') as typeof React, core)

// The request's slot, which `React.cache` keeps in a real render, is a closure that lives as long as
// the style object, as in the tests.
const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

/** A fresh style object of the server build, over a fresh engine and in-memory cache. */
export function createServerStyle(): BenchStyle {
  return bindEngine(
    core.createEngine(theme, fixtures.createBenchOptions()),
    requestCache
  ) as BenchStyle
}
