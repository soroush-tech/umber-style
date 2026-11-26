import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CSP_SERVER_SCENARIOS } from '../helpers/cspServer'
import { expect, test } from '../helpers/test'

// Server components under a strict content security policy, the nonce of each request from the source the
// app registers (see helpers/cspServer.ts), on the production build of the App Router fixture. The
// development tier runs the same ones in dev-tests/csp-server.spec.ts.
for (const scenario of CSP_SERVER_SCENARIOS) {
  test(`policy ${scenario.title}`, async ({ page, browser, request, fixture }, info) => {
    info.fail(scenario.known !== undefined, scenario.known)
    await scenario.run(page, { browser, request, fixture }, 'production')
  })
}

const fixtureRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'fixtures',
  'next-app'
)

/** The class of the client badge in `html`, and the rule of that class in it. */
function readBadge(html: string): { className: string; rule: string } {
  const tag = /<[^>]*data-testid="csp-server-client-badge"[^>]*>/.exec(html)?.[0] ?? ''
  const className = /\sclass="([^"]*)"/.exec(tag)?.[1] ?? ''
  const rule = new RegExp(String.raw`\.${className}\{[^}]*\}`).exec(html)?.[0] ?? ''
  return { className, rule }
}

// The server of the other tests has served requests by the time a scenario runs, so the module of the
// client badge may be loaded already. Here the build is started again, and the badge page is its first
// request, the first time its process loads that module (#71).
test('policy (s3) on a server just started: the first request gives the client badge the class of a later one, with the token', async ({
  fixture,
}) => {
  const port = fixture.port + 200
  const next = createRequire(join(fixtureRoot, 'package.json')).resolve('next/dist/bin/next')
  const server = spawn(process.execPath, [next, 'start', '--port', String(port)], {
    cwd: fixtureRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  try {
    await new Promise<void>((resolve, reject) => {
      server.stdout.on('data', (chunk) => {
        if (String(chunk).includes('Ready')) resolve()
      })
      server.on('exit', (code) => reject(new Error(`the server stopped with ${code}`)))
    })
    const read = async () =>
      readBadge(await (await fetch(`http://localhost:${port}/csp-server/badge`)).text())
    const first = await read()
    expect(first.rule, 'the rule of the class of the badge on the first request').toContain(
      'border-bottom-color:var(--cspsrv-palette-accent)'
    )
    expect(await read(), 'the badge on a later request').toEqual(first)
  } finally {
    server.kill()
  }
})
