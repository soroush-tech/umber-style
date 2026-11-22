/**
 * A declaration that a supported browser still needs next to a standard one: a prefixed property that
 * takes the same value, or, for one value of the property (`forValue`), the same property with a
 * prefixed value.
 */
export interface PrefixedForm {
  /** The property of the declaration that is written first. */
  readonly property: string
  /** The value it is written with; the author's value when there is none. */
  readonly value?: string
  /** The one value of the standard declaration that needs this form; every value when there is none. */
  readonly forValue?: string
  /** The keys a style may declare `property` under itself (`-webkit-user-select`, `WebkitUserSelect`): then it is not written again. */
  readonly keys: readonly string[]
}

/** A prefixed property, with the two keys a style writes it under: as it is, and in camelCase. */
const toPrefixed = (property: string): PrefixedForm => ({
  property,
  keys: [
    property,
    property
      .slice(1)
      .replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
      .replace(/^[a-z]/, (letter) => letter.toUpperCase()),
  ],
})

/** `stretch` of a width: Firefox reads `-moz-available`, Chrome before 138 and Safari before 27 `-webkit-fill-available`. */
const toWidthStretch = (property: string): [string, readonly PrefixedForm[]] => [
  property,
  [
    { property, forValue: 'stretch', value: '-moz-available', keys: [] },
    { property, forValue: 'stretch', value: '-webkit-fill-available', keys: [] },
  ],
]

/** `stretch` of a height: Chrome before 138 and Safari before 27 read `-webkit-fill-available`. */
const toHeightStretch = (property: string): [string, readonly PrefixedForm[]] => [
  property,
  [{ property, forValue: 'stretch', value: '-webkit-fill-available', keys: [] }],
]

/**
 * The declarations that a supported browser (the last two years of Chrome, Edge, Firefox and Safari, iOS
 * Safari included) still needs in a prefixed form, by the standard property, checked on 2026-11-22
 * against the browser compatibility data of MDN and caniuse (`docs/browser-support.md` has the table and
 * its sources). The engine writes each form before the standard declaration, in the same rule.
 */
export const PREFIXED_FORMS: ReadonlyMap<string, readonly PrefixedForm[]> = new Map([
  ['user-select', [toPrefixed('-webkit-user-select')]],
  ['text-size-adjust', [toPrefixed('-webkit-text-size-adjust')]],
  ['print-color-adjust', [toPrefixed('-webkit-print-color-adjust')]],
  ['box-decoration-break', [toPrefixed('-webkit-box-decoration-break')]],
  ['initial-letter', [toPrefixed('-webkit-initial-letter')]],
  ['text-decoration', [toPrefixed('-webkit-text-decoration')]],
  toWidthStretch('width'),
  toWidthStretch('min-width'),
  toWidthStretch('max-width'),
  toHeightStretch('height'),
  toHeightStretch('min-height'),
  toHeightStretch('max-height'),
])
