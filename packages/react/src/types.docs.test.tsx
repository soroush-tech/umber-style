import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createStyle } from './createStyle'

/** The doc comment of `shouldForwardProp` in the types, which says what is not forwarded. */
function readForwardComment(): string {
  const source = readFileSync(join(import.meta.dirname, 'types.ts'), 'utf8')
  return /\/\*\*\s*\*? ?Whether a prop is forwarded[\s\S]*?\*\//.exec(source)?.[0] ?? ''
}

describe('what styled does not forward', () => {
  it('is what the comment of shouldForwardProp lists', () => {
    const { styled } = createStyle({ palette: { primary: '#0000ff' } })
    const Box = styled('div')({ color: 'red' })
    const { container } = render(
      <Box as="section" {...{ theme: {} }} className="mine" style={{ opacity: 1 }} id="kept" />
    )
    const element = container.firstElementChild as HTMLElement
    expect(element.tagName).toBe('SECTION')
    expect(element.id).toBe('kept')
    expect(element.hasAttribute('theme')).toBe(false)
    expect(element.hasAttribute('style')).toBe(false)
    expect(element.className).toContain('mine')
    const comment = readForwardComment()
    for (const name of ['as', 'theme', 'className', 'style'])
      expect(comment).toContain(`\`${name}\``)
  })
})
