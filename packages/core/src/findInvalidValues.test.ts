import { alpha } from './alpha'
import { findInvalidValues } from './findInvalidValues'
import type { StyleObject } from './serialize'

/** A style with what the types do not let through, as plain JavaScript can write it. */
const untyped = (style: object) => style as StyleObject

describe('findInvalidValues', () => {
  it('finds true, a function, a number that is not finite and an object in a list, at any depth', () => {
    expect(
      findInvalidValues(
        untyped({
          width: true,
          color: () => 'red',
          margin: Number.NaN,
          padding: Number.POSITIVE_INFINITY,
          display: ['block', {}, true],
          '&:hover': { opacity: Number.NaN, '@media (min-width: 40em)': { top: true } },
        })
      )
    ).toEqual([
      { key: 'width', kind: 'true' },
      { key: 'color', kind: 'a function' },
      { key: 'margin', kind: 'NaN' },
      { key: 'padding', kind: 'Infinity' },
      { key: 'display', kind: 'an object in a list of values' },
      { key: 'display', kind: 'true' },
      { key: 'opacity', kind: 'NaN' },
      { key: 'top', kind: 'true' },
    ])
  })

  it('finds nothing in a style that is fine, a word the browser may reject included', () => {
    expect(
      findInvalidValues(
        untyped({
          label: 'Button-root',
          borderColor: 'light',
          color: alpha('#ff0000', 0.5),
          background: [alpha('#ff0000', 0.5), 'red'],
          margin: 0,
          padding: null,
          top: undefined,
          left: false,
          native: { elevation: true },
          '&:hover': { opacity: 0.5 },
        })
      )
    ).toEqual([])
  })
})
