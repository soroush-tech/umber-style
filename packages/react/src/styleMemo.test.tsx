import { render } from '@testing-library/react'
import { createCache } from '@umber-style/core'
import { createStyle } from './createStyle'
import type { WebStyle } from './types'

type MemoTheme = { palette: { primary: string } }

/**
 * A tree for the tests of the memo of contents: rows that choose their style by props, cells with a
 * style function of the theme and a prop, a nested hover key, and a plain object in `style`. `shift`
 * moves the props, so that another render has other classes.
 */
function renderMemoTree(style: Pick<WebStyle<MemoTheme>, 'styled'>, shift: number) {
  const { styled } = style
  const Row = styled('div', { name: 'Row', shouldForwardProp: (prop) => prop !== 'isWide' })<{
    isWide: boolean
  }>({ display: 'flex' }, ({ isWide }) => ({ gap: isWide ? 16 : 4, padding: isWide ? '1px' : 1 }))
  const Cell = styled('span', { name: 'Cell', shouldForwardProp: (prop) => prop !== 'tone' })<{
    tone: number
  }>(({ theme, tone }) => ({
    color: theme.palette.primary,
    opacity: tone / 4,
    '&:hover': { opacity: (tone + 1) / 4 },
  }))
  return (
    <main>
      {Array.from({ length: 12 }, (_, row) => (
        <Row key={row} isWide={(row + shift) % 2 === 0}>
          {Array.from({ length: 3 }, (_, cell) => (
            <Cell key={cell} tone={(cell + shift) % 4} style={{ margin: (row + shift) % 3 }}>
              {row}
            </Cell>
          ))}
        </Row>
      ))}
    </main>
  )
}

afterEach(() => {
  document.head.innerHTML = ''
})

describe('the memo of contents, in a document', () => {
  it('gives the same markup and the same style elements with it on as with it off', () => {
    const [off, on] = [false, true].map((hasStyleMemo) => {
      const cache = createCache({ prefix: 'r', hasDevChecks: false, hasStyleMemo })
      const style = createStyle({ palette: { primary: '#0000ff' } }, { prefix: 'r', cache })
      const { container, rerender, unmount } = render(renderMemoTree(style, 0))
      const html = [container.innerHTML]
      for (const shift of [1, 0, 2]) {
        rerender(renderMemoTree(style, shift))
        html.push(container.innerHTML)
      }
      const result = { html, head: document.head.innerHTML, css: cache.extract().css }
      unmount()
      document.head.innerHTML = ''
      return result
    })
    expect(on).toEqual(off)
    expect(on.css).toContain('gap:16px')
  })
})
