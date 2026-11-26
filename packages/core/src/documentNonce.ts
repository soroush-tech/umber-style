/**
 * The nonce of `page`, for a style element that the engine makes there with no nonce configured: the
 * `.nonce` of a style element that the policy let in (it has a sheet), else that of a script. Undefined
 * when none is found. It is read from the property, which the browser keeps when it hides the attribute,
 * and never from a style element with no sheet: one the policy refused (injected with a nonce it does not
 * allow) is not a source. A nonce read from the page can only make the elements written with it refused
 * when it is wrong: it never lets in what the policy refuses.
 */
export function readPageNonce(page: Document): string | undefined {
  for (const element of page.querySelectorAll<HTMLStyleElement>('style[nonce]')) {
    if (element.sheet !== null && element.nonce) return element.nonce
  }
  return page.querySelector<HTMLScriptElement>('script[nonce]')?.nonce || undefined
}
