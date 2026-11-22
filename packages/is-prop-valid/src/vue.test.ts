import isPropValid, { isPropValid as namedIsPropValid } from './vue'

/** The names of `names` that the entry answers `expected` for: `[]` when it agrees on every one. */
function findOther(names: string[], expected: boolean) {
  return names.filter((name) => isPropValid(name) !== expected)
}

describe('isPropValid of the Vue entry', () => {
  it('is true for the attributes of HTML in their HTML form', () => {
    expect(
      findOther(
        [
          'id',
          'class',
          'for',
          'tabindex',
          'readonly',
          'maxlength',
          'http-equiv',
          'accept-charset',
          'autoplay',
          'srcset',
          'fetchpriority',
          'popover',
          'popovertarget',
          'popovertargetaction',
          'shadowrootmode',
          'writingsuggestions',
          'blocking',
          'slot',
          'commandfor',
        ],
        true
      )
    ).toEqual([])
  })

  it('is true for the attributes of SVG in their XML form', () => {
    expect(
      findOther(
        [
          'd',
          'stroke-width',
          'fill-opacity',
          'mask-type',
          'transform-origin',
          'units-per-em',
          'panose-1',
          'viewBox',
          'preserveAspectRatio',
          'stdDeviation',
          'xlink:href',
          'xml:lang',
          'xml:space',
          'xmlns:xlink',
          'k4',
          'in2',
        ],
        true
      )
    ).toEqual([])
  })

  it('is true for the DOM properties that Vue sets by their name', () => {
    expect(
      findOther(
        [
          'tabIndex',
          'readOnly',
          'maxLength',
          'className',
          'htmlFor',
          'innerHTML',
          'innerText',
          'textContent',
          'defaultValue',
          'defaultChecked',
          'allowFullscreen',
          'formEnctype',
          'popoverTargetAction',
          'shadowRootMode',
        ],
        true
      )
    ).toEqual([])
  })

  it("is true for class, style, key, ref, is and Vue's own ref_for and ref_key", () => {
    const names = ['class', 'style', 'key', 'ref', 'is', 'ref_for', 'ref_key']
    expect(findOther(names, true)).toEqual([])
  })

  it('is true for data-, aria-, and a listener: on, an upper-case letter, and any suffix', () => {
    expect(
      findOther(
        [
          'data-row',
          'aria-label',
          'onClick',
          'onClickOnce',
          'onClickCapture',
          'onScrollPassive',
          'onUpdate:modelValue',
          'onTransitionend',
        ],
        true
      )
    ).toEqual([])
  })

  it("is false for as, theme, the props of a component, and React's spellings Vue does not write", () => {
    expect(
      findOther(
        [
          'as',
          'theme',
          'variant',
          'isActive',
          'bg',
          'p',
          'mt',
          'children',
          'dangerouslySetInnerHTML',
          'suppressHydrationWarning',
          'strokeWidth',
          'fillOpacity',
          'xmlLang',
          'onclick',
          'DATA-row',
          'x-init',
        ],
        false
      )
    ).toEqual([])
  })

  it('is true for color, size, width and height: they are attributes of HTML and SVG', () => {
    expect(findOther(['color', 'size', 'width', 'height'], true)).toEqual([])
  })

  it('is the named export too', () => {
    expect(namedIsPropValid).toBe(isPropValid)
  })
})
