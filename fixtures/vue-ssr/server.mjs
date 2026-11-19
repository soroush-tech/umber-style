import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// The production server of the fixture: one long-lived process that renders each request.
const root = fileURLToPath(new URL('.', import.meta.url))
const client = join(root, 'dist', 'client')
const template = readFileSync(join(client, 'index.html'), 'utf8')
const { render } = await import(pathToFileURL(join(root, 'dist', 'server', 'entry-server.js')).href)

const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }
const routes = new Set(['/', '/catalog', '/settings'])

createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname
  try {
    if (routes.has(path)) {
      const { html, styleTag, boot, htmlClass } = await render(path)
      const page = template
        .replace('<!--html-class-->', htmlClass)
        .replace('<!--ssr-style-->', () => styleTag)
        .replace('<!--ssr-boot-->', () => boot)
        .replace('<!--ssr-app-->', () => html)
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page)
      return
    }
    const file = join(client, normalize(path))
    if (!file.startsWith(client)) throw new Error('outside the client folder')
    response
      .writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
      .end(readFileSync(file))
  } catch {
    response.writeHead(404).end('Not found')
  }
}).listen(4105, () => console.log('vue-ssr on http://localhost:4105'))
