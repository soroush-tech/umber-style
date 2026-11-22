import isPropValid, { isPropValid as namedIsPropValid } from './react'

/** The names of `names` that the entry answers `expected` for: `[]` when it agrees on every one. */
function findOther(names: string[], expected: boolean) {
  return names.filter((name) => isPropValid(name) !== expected)
}

describe('isPropValid of the React entry', () => {
  it('is true for the attributes of HTML and SVG under the names React gives them', () => {
    expect(
      findOther(
        [
          'id',
          'tabIndex',
          'htmlFor',
          'className',
          'readOnly',
          'autoPlay',
          'srcSet',
          'httpEquiv',
          'acceptCharset',
          'fetchPriority',
          'popoverTarget',
          'inert',
          'blocking',
          'strokeWidth',
          'fillOpacity',
          'viewBox',
          'preserveAspectRatio',
          'xlinkHref',
          'xmlLang',
          'xmlnsXlink',
          'k4',
          'in2',
        ],
        true
      )
    ).toEqual([])
  })

  it("is true for React's own props", () => {
    expect(
      findOther(
        [
          'children',
          'ref',
          'key',
          'style',
          'dangerouslySetInnerHTML',
          'defaultValue',
          'defaultChecked',
          'suppressContentEditableWarning',
          'suppressHydrationWarning',
          'precedence',
        ],
        true
      )
    ).toEqual([])
  })

  it('is true for the attributes the engine forwarded that React does not type yet', () => {
    expect(
      findOther(
        [
          'closedBy',
          'command',
          'commandFor',
          'exportParts',
          'isMap',
          'shadowRootClonable',
          'shadowRootDelegatesFocus',
          'shadowRootMode',
          'shadowRootSerializable',
          'writingSuggestions',
          'maskType',
          'side',
          'transformOrigin',
        ],
        true
      )
    ).toEqual([])
  })

  it('is true for the older and other spellings that apps forward today', () => {
    expect(
      findOther(
        [
          'innerHTML',
          'valueLink',
          'allowUserMedia',
          'allowPaymentRequest',
          'allowTransparency',
          'fetchpriority',
          'profile',
          'incremental',
          'fallback',
          'on',
          'option',
          'for',
          'class',
          'autofocus',
        ],
        true
      )
    ).toEqual([])
  })

  it('is true for on and any character whose code is below 91, as the predicate apps use today is', () => {
    expect(
      findOther(
        [
          'onA',
          'onZ',
          'on-click',
          'on1',
          'on9x',
          'on:x',
          'on@',
          'on ',
          'on!',
          'on.x',
          'on\u0000',
          'on\u001f',
        ],
        true
      )
    ).toEqual([])
    expect(
      findOther(['on[', 'on_x', 'on`', 'onclick', 'onz', 'oné', 'on\u{1f600}'], false)
    ).toEqual([])
  })

  it('is true for data- and aria- in any case, for x-, and for on and an upper-case letter', () => {
    expect(
      findOther(
        [
          'data-row',
          'data-row-1',
          'DATA-row',
          'Data-row',
          'aria-label',
          'ARIA-label',
          'x-init',
          'onClick',
          'onPointerDownCapture',
          'onA',
        ],
        true
      )
    ).toEqual([])
  })

  it('is false for as, theme, the props of a component and names close to an attribute', () => {
    expect(
      findOther(
        [
          'as',
          'theme',
          'variant',
          'isActive',
          'tone',
          'sx',
          'css',
          'bg',
          'p',
          'mt',
          'px',
          'datax',
          'dataRow',
          'ariaLabel',
          'X-init',
          'onclick',
          'stroke-width',
          'tabindex',
          '',
        ],
        false
      )
    ).toEqual([])
  })

  it('is true for color, size, width and height: they are attributes of HTML and SVG', () => {
    expect(findOther(['color', 'size', 'width', 'height'], true)).toEqual([])
  })

  it('gives the same answer to a name asked again', () => {
    expect(['tone', 'tone', 'alt', 'alt', 'data-x', 'data-x'].map(isPropValid)).toEqual([
      false,
      false,
      true,
      true,
      true,
      true,
    ])
  })

  it('is the named export too', () => {
    expect(namedIsPropValid).toBe(isPropValid)
  })
})
