import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// The production server of the fixture: one long-lived process that renders each request.
const root = fileURLToPath(new URL('.', import.meta.url))
const client = join(root, 'dist', 'client')
const template = readFileSync(join(client, 'index.html'), 'utf8')
const { render } = await import(pathToFileURL(join(root, 'dist', 'server', 'entry-server.js')).href)

const CONTENT_TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }
const ROUTES = new Set(['/', '/catalog', '/settings', '/promo'])

createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost')
  const path = url.pathname
  try {
    if (ROUTES.has(path)) {
      // A nonce for each request; with ?csp the page is sent under a policy that allows style
      // elements and inline scripts by that nonce only (e2e/tests/vue-ssr.csp.spec.ts).
      const nonce = randomBytes(16).toString('base64')
      const { html, styleTag, boot, htmlClass } = await render(path, nonce)
      const page = template
        .replace('<!--html-class-->', htmlClass)
        .replace('<!--ssr-style-->', () => styleTag)
        .replace('<!--ssr-boot-->', () => boot)
        .replace('<!--ssr-app-->', () => html)
        .replaceAll('<!--ssr-nonce-->', nonce)
      const headers = { 'content-type': 'text/html; charset=utf-8' }
      if (url.searchParams.has('csp')) {
        headers['content-security-policy'] =
          `style-src 'nonce-${nonce}'; script-src 'self' 'nonce-${nonce}'`
      }
      response.writeHead(200, headers).end(page)
      return
    }
    const file = join(client, normalize(path))
    if (!file.startsWith(client)) throw new Error('outside the client folder')
    response
      .writeHead(200, {
        'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
      })
      .end(readFileSync(file))
  } catch {
    response.writeHead(404).end('Not found')
  }
}).listen(4105, () => console.log('vue-ssr on http://localhost:4105'))
