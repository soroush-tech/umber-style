import { expect, type Page } from '@playwright/test'

/** The computed properties that are compared: what a style change would show in. */
export const COMPARED_PROPERTIES = [
  'color',
  'backgroundColor',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'borderTopWidth',
  'borderTopStyle',
  'borderTopColor',
  'borderRightWidth',
  'borderRightStyle',
  'borderRightColor',
  'borderBottomWidth',
  'borderBottomStyle',
  'borderBottomColor',
  'borderLeftWidth',
  'borderLeftStyle',
  'borderLeftColor',
  'borderTopLeftRadius',
  'display',
  'flexDirection',
  'flexWrap',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'gap',
  'gridTemplateColumns',
  'fontSize',
  'fontWeight',
  'fontFamily',
  'opacity',
  'width',
] as const

/** An element's key mapped to its computed properties. */
export type ComputedStyles = Record<string, Record<string, string>>

export const APP_ROOT = '[data-testid="app-root"]'

/**
 * For every element under the app root (the root included): a stable key, the `data-testid` or the
 * structural path from the root, mapped to the computed value of each of `COMPARED_PROPERTIES`.
 */
export async function collectComputedStyles(
  page: Page,
  root: string = APP_ROOT
): Promise<ComputedStyles> {
  return page.evaluate(
    ({ rootSelector, properties }) => {
      const start = document.querySelector(rootSelector)
      if (!start) throw new Error(`No element matches ${rootSelector}`)
      const result: Record<string, Record<string, string>> = {}
      const walk = (element: Element, path: string) => {
        const testId = element.getAttribute('data-testid')
        let key = testId ? `${testId}` : path
        // A test id that repeats is told apart by its path.
        if (key in result) key = `${key}@${path}`
        const computed = getComputedStyle(element)
        const entry: Record<string, string> = {}
        for (const property of properties) entry[property] = computed[property as never]
        result[key] = entry
        let index = 0
        for (const child of element.children) {
          index += 1
          walk(child, `${path}/${child.tagName.toLowerCase()}[${index}]`)
        }
      }
      walk(start, start.tagName.toLowerCase())
      return result
    },
    { rootSelector: root, properties: [...COMPARED_PROPERTIES] }
  )
}

/** The differences between two collections, one readable line each. */
export function diffStyles(first: ComputedStyles, second: ComputedStyles): string[] {
  const lines: string[] = []
  for (const key of Object.keys(first)) {
    if (!(key in second)) {
      lines.push(`${key}: only in the first`)
      continue
    }
    for (const property of Object.keys(first[key])) {
      if (first[key][property] !== second[key][property]) {
        lines.push(`${key} ${property}: ${first[key][property]}  !=  ${second[key][property]}`)
      }
    }
  }
  for (const key of Object.keys(second)) {
    if (!(key in first)) lines.push(`${key}: only in the second`)
  }
  return lines
}

/** Fails with the list of differences when the two collections are not equal. */
export function expectSameStyles(
  first: ComputedStyles,
  second: ComputedStyles,
  label = 'styles'
): void {
  const lines = diffStyles(first, second)
  expect(
    lines,
    `${label}: ${lines.length} difference(s)\n${lines.slice(0, 40).join('\n')}`
  ).toEqual([])
}
