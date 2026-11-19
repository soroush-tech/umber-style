import { createServer } from 'node:net'
import { chromium } from '@playwright/test'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'

export interface LighthouseNumbers {
  /** The performance score, 0 to 1. */
  score: number
  /** Total blocking time in milliseconds. */
  totalBlockingTime: number
  /** Bytes of CSS that no element used while the page loaded, as Lighthouse reports it. */
  unusedCssBytes: number
  /** Bytes of JavaScript that did not run while the page loaded. */
  unusedJavaScriptBytes: number
  /** Bytes transferred for the whole page. */
  transferBytes: number
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, () => {
      const address = server.address()
      server.close(() =>
        address && typeof address === 'object'
          ? resolve(address.port)
          : reject(new Error('no port'))
      )
    })
  })
}

/**
 * Runs Lighthouse (the `lighthouse` package, desktop preset, performance category) against `url`,
 * driving the same Chromium that Playwright installs: Playwright launches it with a debugging port.
 */
export async function runLighthouse(url: string): Promise<LighthouseNumbers> {
  const port = await freePort()
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] })
  try {
    const run = await lighthouse(
      url,
      { port, output: 'json', logLevel: 'error', onlyCategories: ['performance'] },
      desktopConfig
    )
    if (!run) throw new Error('Lighthouse returned no result')
    const { lhr } = run
    const savings = (id: string) =>
      Number(
        (lhr.audits[id]?.details as { overallSavingsBytes?: number } | undefined)
          ?.overallSavingsBytes ?? 0
      )
    return {
      score: lhr.categories.performance.score ?? 0,
      totalBlockingTime: Number(lhr.audits['total-blocking-time'].numericValue ?? 0),
      unusedCssBytes: savings('unused-css-rules'),
      unusedJavaScriptBytes: savings('unused-javascript'),
      transferBytes: Number(lhr.audits['total-byte-weight'].numericValue ?? 0),
    }
  } finally {
    await browser.close()
  }
}
