// What the files of the client build load, in this order: the process is made to run built code
// (`prepareBuiltPackages`: production React, the built core), then React, `react-dom/server` and the
// built binding are loaded after it. A file imports this module before anything that loads React.
import type * as Core from '@umber-style/core'
import { createRequire } from 'node:module'
import type * as React from 'react'
import type * as ReactDomServer from 'react-dom/server'
import { prepareBuiltPackages } from '../../../bench/src/built'
import type * as Binding from '../src/index'
import { createFixtures } from './fixtures'

prepareBuiltPackages()
const load = createRequire(import.meta.url)

export const { renderToString } = load('react-dom/server') as typeof ReactDomServer
export const binding = load('../dist/index.cjs') as typeof Binding
export const fixtures = createFixtures(
  load('react') as typeof React,
  load('../../core/dist/index.cjs') as typeof Core
)
