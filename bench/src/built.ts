// What a benchmark file of a binding calls before it loads a built package. soroush-bench runs the file
// with tsx in its sandbox, where nothing outside the file sets an environment variable or an export
// condition, and where the workspace link of `@umber-style/core` points at the TypeScript source (its
// `exports` name `dist` only in `publishConfig`). This sets all three from inside the process.
import { registerHooks } from 'node:module'

export interface BuiltOptions {
  /** Bare specifiers loaded from another file instead, as file URLs: a stand-in for a platform module. */
  redirects?: Readonly<Record<string, string>>
  /** Export conditions added to every resolution, such as `react-server` for the server build of React. */
  conditions?: readonly string[]
}

/**
 * Makes what is loaded after this call run as a built app would: `NODE_ENV` is `production` (React and
 * Vue take their production paths), `@umber-style/core` is the built core of this checkout, and the
 * redirects and conditions of `options` apply. Only modules resolved after the call see it, so a file
 * calls it first and loads React, Vue and the built binding after it, with `createRequire`. Returns the
 * registration: `deregister()` ends it.
 */
export function prepareBuiltPackages({ redirects = {}, conditions = [] }: BuiltOptions = {}) {
  process.env.NODE_ENV = 'production'
  const targets: Record<string, string> = {
    '@umber-style/core': new URL('../../packages/core/dist/index.cjs', import.meta.url).href,
    ...redirects,
  }
  return registerHooks({
    resolve: (specifier, context, nextResolve) =>
      Object.hasOwn(targets, specifier)
        ? { url: targets[specifier], shortCircuit: true }
        : nextResolve(specifier, {
            ...context,
            conditions: [...context.conditions, ...conditions],
          }),
  })
}
