/**
 * The nonce of `page`, for a style element that the engine makes there with no nonce configured: the
 * `.nonce` of a style element that the policy let in (it has a sheet), else that of a script. Undefined
 * when none is found. It is read from the property, which the browser keeps when it hides the attribute,
 * and never from a style element with no sheet: one the policy refused (injected with a nonce it does not
 * allow) is not a source. A nonce read from the page can only make the elements written with it refused
 * when it is wrong: it never lets in what the policy refuses.
 */
export function readPageNonce(page: Document): string | undefined {
  return findPageNonce(page)?.nonce
}

/** A nonce read from a page, and the kind of element it came from: a script's is not always the one of styles. */
export interface PageNonce {
  nonce: string
  from: 'style' | 'script'
}

/** `readPageNonce`, with where the nonce came from. Undefined when none is found. */
export function findPageNonce(page: Document): PageNonce | undefined {
  for (const element of page.querySelectorAll<HTMLStyleElement>('style[nonce]')) {
    if (element.sheet !== null && element.nonce) return { nonce: element.nonce, from: 'style' }
  }
  const nonce = page.querySelector<HTMLScriptElement>('script[nonce]')?.nonce
  return nonce ? { nonce, from: 'script' } : undefined
}
