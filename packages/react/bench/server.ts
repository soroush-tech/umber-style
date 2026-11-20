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
