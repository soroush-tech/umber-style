import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join, normalize, sep } from 'node:path'

// A server of a static build under a strict content security policy, as a host that injects a nonce into
// the HTML on the way out: for each response of a page it makes a new nonce, writes it on every `<script>`
// and `<style>` start tag of the page's file (the build marks nothing: every such tag of the file is the
// build's own, as a static build holds no content of a visitor), and sends
// `style-src 'nonce-<n>'; script-src 'self' 'nonce-<n>'`. The files the pages load are sent as they are.

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
}

/** `html` with `nonce` on every `<script>` and `<style>` start tag. */
export const injectNonce = (html: string, nonce: string): string =>
  html.replace(/<(script|style)(?=[\s>])/g, `<$1 nonce="${nonce}"`)

/** The policy of a page whose nonce is `nonce`. */
export const createPolicy = (nonce: string): string =>
  `style-src 'nonce-${nonce}'; script-src 'self' 'nonce-${nonce}'`

/** What `serveStatic` serves: where, and how to stop it. */
export interface StaticServer {
  readonly origin: string
  close(): Promise<void>
}

/** The file of `root` that `pathname` asks for: a page is the `index.html` of its folder. */
function findFile(root: string, pathname: string): string {
  const file = join(root, normalize(decodeURIComponent(pathname)))
  if (file !== root && !file.startsWith(root + sep)) throw new Error('outside the build')
  return extname(file) === '' ? join(file, 'index.html') : file
}

/**
 * Serves the static build in `root` on a free port, every page under the policy. With `isInjecting` false
 * (the negative control) the policy is sent but no tag gets the nonce, so the policy refuses them.
 */
export async function serveStatic(root: string, isInjecting = true): Promise<StaticServer> {
  const server = createServer(async (request, response) => {
    try {
      const file = findFile(root, new URL(request.url ?? '/', 'http://localhost').pathname)
      const type = CONTENT_TYPES[extname(file)] ?? 'application/octet-stream'
      if (type !== CONTENT_TYPES['.html']) {
        response.writeHead(200, { 'content-type': type }).end(await readFile(file))
        return
      }
      const nonce = randomBytes(16).toString('base64')
      const html = await readFile(file, 'utf8')
      response
        .writeHead(200, { 'content-type': type, 'content-security-policy': createPolicy(nonce) })
        .end(isInjecting ? injectNonce(html, nonce) : html)
    } catch {
      response.writeHead(404).end('Not found')
    }
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const { port } = server.address() as AddressInfo
  return {
    origin: `http://localhost:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}
