// The one nonce of every response under /csp-fixed: proxy.ts puts it in the policy, and `./style` gives it
// to the engine's cache. A fixed value is what an app has whose policy names the same nonce each time; it
// is not a secret here, as the fixture is a test of what the engine does with it.
export const FIXED_NONCE = 'Zml4ZWQtbm9uY2UtZm9yLXRoZS1maXR1cmU='
