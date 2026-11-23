import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createCache } from '@umber-style/core'
import { CacheProvider } from './CacheProvider'
import { createStyle } from './createStyle'
import { createDefaultStyle } from './defaultStyle'
import type { WebStyle } from './types'

// The ways to turn the memo of contents on in docs/style-memo.md.
const theme = { palette: { primary: '#0000ff' } }

afterEach(() => {
  document.head.innerHTML = ''
})

/**
 * Renders a component whose style has a condition, four times with the same props, each time a new
 * object, with a nested hover style that counts the reads of its values: a compile reads them, and a
 * style that the memo finds by its contents is not compiled. Gives the classes, the reads and the CSS.
 */
function renderTitles(
  { styled }: Pick<WebStyle<typeof theme>, 'styled'>,
  wrap: (node: ReactNode) => ReactNode = (node) => node
) {
  let reads = 0
  const hover = new Proxy(
    { color: 'red' },
    {
      get(target, key, receiver) {
        reads++
        return Reflect.get(target, key, receiver) as unknown
      },
    }
  )
  const Heading = styled('h2')<{ isMobile: boolean }>(({ isMobile }) => ({
    fontSize: isMobile ? 12 : 48,
    '&:hover': hover,
  }))
  const classes = Array.from({ length: 4 }, () => {
    const { container, unmount } = render(wrap(<Heading isMobile />))
    const { className } = container.firstElementChild as HTMLElement
    unmount()
    return className
  })
  return { classes, reads }
}

describe('the memo of contents, turned on', () => {
  it('by createStyle: a function of props has the class it has without it (docs/style-memo.md)', () => {
    const style = createStyle(theme, { prefix: 'memo', hasStyleMemo: true })
    const Title = style.styled('h1')<{ isMobile: boolean }>(({ isMobile }) => ({
      fontSize: isMobile ? 12 : 48,
    }))
    const plain = createStyle(theme, { prefix: 'memo' })
    const Plain = plain.styled('h1')<{ isMobile: boolean }>(({ isMobile }) => ({
      fontSize: isMobile ? 12 : 48,
    }))
    const classOf = (node: ReactNode) => {
      const { container, unmount } = render(node)
      const { className } = container.firstElementChild as HTMLElement
      unmount()
      return className
    }
    const titles = [true, true, true, false].map((isMobile) =>
      classOf(<Title isMobile={isMobile} />)
    )
    const plains = [true, true, true, false].map((isMobile) =>
      classOf(<Plain isMobile={isMobile} />)
    )
    expect(titles).toEqual(plains)
    expect(style.engine.cache.extract().css).toContain(`.${titles[0]}{font-size:12px;}`)
    expect(style.engine.cache.extract().css).toContain(`.${titles[3]}{font-size:48px;}`)
  })

  it('by createStyle: a style found by its contents is not compiled again', () => {
    const off = renderTitles(createStyle(theme, { prefix: 'off' }))
    const on = renderTitles(createStyle(theme, { prefix: 'on', hasStyleMemo: true }))
    expect(on.classes.map((name) => name.replace('on-', ''))).toEqual(
      off.classes.map((name) => name.replace('off-', ''))
    )
    expect(on.reads).toBeLessThan(off.reads)
  })

  it('by configure, on the default style', () => {
    const plain = createDefaultStyle()
    plain.configure({ prefix: 'off' })
    const off = renderTitles(plain as unknown as WebStyle<typeof theme>)
    const { configure, styled } = createDefaultStyle()
    configure({ prefix: 'on', hasStyleMemo: true })
    const on = renderTitles({ styled } as unknown as WebStyle<typeof theme>)
    expect(on.reads).toBeLessThan(off.reads)
  })

  it('by the cache of a CacheProvider, which decides for its subtree', () => {
    const style = createDefaultStyle()
    style.configure({ prefix: 'app' })
    const typed = style as unknown as WebStyle<typeof theme>
    const off = renderTitles(typed)
    const cache = createCache({ prefix: 'page', hasStyleMemo: true })
    const wrap = (node: ReactNode) => <CacheProvider value={cache}>{node}</CacheProvider>
    const on = renderTitles(typed, wrap)
    expect(on.classes[0]).toMatch(/^page-/)
    expect(on.reads).toBeLessThan(off.reads)
    const without = createCache({ prefix: 'other' })
    const under = renderTitles(createStyle(theme, { cache: without, hasStyleMemo: true }))
    expect(under.reads).toBe(off.reads)
  })
})
