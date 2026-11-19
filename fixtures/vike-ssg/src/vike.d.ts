import type { ReactNode } from 'react'

declare global {
  namespace Vike {
    interface PageContext {
      Page: () => ReactNode
    }
  }
}

export {}
