import { defineConfig } from 'vite'

export default defineConfig({
  // The workspace packages export TypeScript source: the server bundle includes them.
  ssr: { noExternal: true },
})
