import type { StyleObject } from '@umber-style/core'

/** Whether `value` is a nested style object, which React Native cannot use. */
function isNested(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `style` without the web-only keys: `label`, and every key that holds an object (selectors, media queries). */
export function toNativeStyle(style: StyleObject): StyleObject {
  return Object.fromEntries(
    Object.entries(style).filter(([key, value]) => key !== 'label' && !isNested(value))
  )
}
