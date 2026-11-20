// The built core of this checkout, which the files here measure (`pnpm build` first). It is loaded by
// path, as the gate files load it, and typed by its source, so that the type check needs no build.
import { createRequire } from 'node:module'
import type * as Core from '../src/index'

export const core = createRequire(import.meta.url)('../dist/index.cjs') as typeof Core
