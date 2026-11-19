import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createApp, h } from 'vue'
import { createStyle } from './createStyle'

/** The doc comment of `shouldForwardProp` in the types, which says what is not forwarded. */
function readForwardComment(): string {
  const source = readFileSync(join(import.meta.dirname, 'types.ts'), 'utf8')
  return /\/\*\* Whether an attribute is forwarded[^\n]*\*\//.exec(source)?.[0] ?? ''
}

describe('what styled does not forward', () => {
  it('is what the comment of shouldForwardProp lists', () => {
    const { styled } = createStyle({ palette: { primary: '#0000ff' } })
    const Box = styled('div')({ color: 'red' })
    const root = document.createElement('div')
    createApp(() =>
      h(Box, { as: 'section', theme: {}, class: 'mine', style: { opacity: 1 }, id: 'kept' })
    ).mount(root)
    const element = root.firstElementChild as HTMLElement
    expect(element.tagName).toBe('SECTION')
    expect(element.id).toBe('kept')
    expect(element.hasAttribute('theme')).toBe(false)
    expect(element.hasAttribute('style')).toBe(false)
    expect(element.className).toContain('mine')
    const comment = readForwardComment()
    for (const name of ['as', 'theme', 'class', 'style']) expect(comment).toContain(`\`${name}\``)
  })
})
