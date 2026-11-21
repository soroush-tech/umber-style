import { expect, type Page, type TestInfo } from '@playwright/test'

/** The selector of the global rule that the promo page of every fixture writes for the bar of the shell. */
export const OVERRIDE_SELECTOR = '[data-testid="nav"]'

/** The outline of the bar that the rule gives, in each scheme: the accent colour of the theme. */
export const OVERRIDE = {
  light: { outlineStyle: 'solid', outlineWidth: '3px', outlineColor: 'rgb(179, 38, 30)' },
  dark: { outlineStyle: 'solid', outlineWidth: '3px', outlineColor: 'rgb(255, 138, 128)' },
}

/** The bar with no rule: no outline (its width is then the initial `medium`, which Chromium computes as 3px). */
export const NO_OVERRIDE = { outlineStyle: 'none' }

/** The computed outline of the bar. */
export function readHeader(page: Page) {
  return page.getByTestId('nav').evaluate((element) => {
    const computed = getComputedStyle(element)
    return {
      outlineStyle: computed.outlineStyle,
      outlineWidth: computed.outlineWidth,
      outlineColor: computed.outlineColor,
    }
  })
}

/** The outline style of the bar, which says whether the rule applies, whatever the scheme. */
export async function readHeaderShape(page: Page) {
  const { outlineStyle } = await readHeader(page)
  return { outlineStyle }
}

/** Where the global rule for the bar is found in the document. */
export interface OverrideRules {
  /** One entry for each rule for the bar that a style sheet of the document holds: its element. */
  sheets: string[]
  /** One entry for each time the text of a style element of the document holds the rule: its element. */
  texts: string[]
}

/**
 * Where the rule for the bar is in the document: in the rules that the browser holds (every style sheet,
 * the rules inside layers and other groups included), and in the text of every style element, in the
 * head or the body. Each is named by its element: tag, attributes and parent, so that a rule that stays
 * says which element keeps it.
 */
export function findOverrideRules(page: Page): Promise<OverrideRules> {
  return page.evaluate((selector) => {
    const describe = (node: Node | null): string => {
      if (!(node instanceof Element)) return String(node)
      const attributes = [...node.attributes]
        .map((attribute) => `${attribute.name}="${attribute.value.slice(0, 80)}"`)
        .join(' ')
      return `<${node.tagName.toLowerCase()} ${attributes}> in ${node.parentElement?.tagName ?? 'nothing'}`
    }
    const sheets: string[] = []
    const visit = (list: CSSRuleList, owner: string) => {
      for (const rule of list) {
        if (rule instanceof CSSStyleRule && rule.selectorText === selector) sheets.push(owner)
        else if ('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules, owner)
      }
    }
    for (const sheet of document.styleSheets) visit(sheet.cssRules, describe(sheet.ownerNode))
    const texts: string[] = []
    const pattern = /\[data-testid="nav"\]\s*\{/g
    for (const element of document.querySelectorAll('style')) {
      for (const _ of (element.textContent ?? '').matchAll(pattern)) texts.push(describe(element))
    }
    return { sheets, texts }
  }, OVERRIDE_SELECTOR)
}

/** The bar has the outline of the rule, and the style sheets of the document hold the rule once. */
export async function expectOverride(page: Page, where: string): Promise<void> {
  await expect.poll(() => readHeader(page), `the bar on ${where}`).toEqual(OVERRIDE.light)
  const { sheets } = await findOverrideRules(page)
  expect(sheets, `the rule in the style sheets on ${where}`).toHaveLength(1)
}

/**
 * The bar has no outline, and no style sheet of the document holds the rule: on failure the message
 * names each element whose sheet keeps it. The text of a style element that came with the HTML is not
 * changed when the cache deletes a rule from its sheet: where it still holds the rule is written down as
 * an annotation, `text`, for the report.
 */
export async function expectNoOverride(page: Page, where: string, info: TestInfo): Promise<void> {
  const read = async () => ({
    header: await readHeaderShape(page),
    sheets: (await findOverrideRules(page)).sheets,
  })
  await expect
    .poll(read, `the bar on ${where}, and the style sheets that still hold its rule`)
    .toEqual({ header: NO_OVERRIDE, sheets: [] })
  const { texts } = await findOverrideRules(page)
  info.annotations.push({
    type: 'text',
    description: `${where}: ${texts.length === 0 ? 'no style element' : texts.join(', ')} holds the text of the rule`,
  })
}
