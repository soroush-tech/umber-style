// The examples of "Style sheets and the style prop" (`css()`), "Writing styles" (the template form, a
// component as a selector) and "Animations and global styles" (the template form of keyframes), as the
// pages show them.
import { render, screen } from '@testing-library/react'
import { createCache, createMemorySheet } from '@umber-style/core'
import { createStyle } from './createStyle'

const theme = {
  palette: { primary: '#1b5fd1', onPrimary: '#ffffff' },
  space: [0, 4, 8, 16],
}

function setup() {
  const sheet = createMemorySheet()
  const style = createStyle(theme, {
    prefix: 'umber',
    cache: createCache({ prefix: 'umber', sheet }),
  })
  return { ...style, sheet }
}

describe('the css() example', () => {
  it('renders the button, the plain elements and their rules', () => {
    const { css, styled, apply, sheet } = setup()

    const card = css({ padding: 8, borderRadius: 4 })
    const danger = css(card, { backgroundColor: 'firebrick' })
    const raised = css`
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    `

    const Button = styled('button', { name: 'Button' })(card, { color: 'white' })

    const App = () => (
      <>
        <Button style={danger}>Delete</Button>
        <p className={String(raised)}>raised</p>
        <p {...apply(card, raised)}>both</p>
      </>
    )

    render(<App />)
    const [own, override] = screen.getByText('Delete').className.split(' ')
    expect(own).toMatch(/^umber-button-root-/)
    expect(sheet.rules).toContain(
      `@layer umber-overrides{.${override}{padding:8px;border-radius:4px;background-color:firebrick;}}`
    )
    expect(screen.getByText('raised').className).toBe(raised.className)
    expect(screen.getByText('both').className).toMatch(/^umber-[a-z0-9]+$/)
    expect(sheet.rules.some((rule) => rule.includes('style='))).toBe(false)
  })
})

describe('the template examples', () => {
  it('makes the same class as the equal object style, and a props class from a function', () => {
    const { styled } = setup()

    const Title = styled('h1', { name: 'Title' })<{ isMuted?: boolean }>`
      margin: 0;
      color: ${({ theme, isMuted }) => (isMuted ? 'gray' : theme.palette.primary)};
      &:hover {
        opacity: 0.8;
      }
      @media (min-width: 600px) {
        font-size: 2rem;
      }
    `
    const Tag = styled.span`
      padding: ${({ theme }) => theme.space[1]}px 8px;
    `

    render(
      <>
        <Title>Hello</Title>
        <Title isMuted>Muted</Title>
        <Tag>tag</Tag>
      </>
    )
    expect(screen.getByText('Hello').className).not.toBe(screen.getByText('Muted').className)
    expect(screen.getByText('tag').className.split(' ')).toHaveLength(1)
  })

  it('uses a component as a selector: its target, else its class', () => {
    const { styled, sheet } = setup()

    const Icon = styled('span', { name: 'Icon', target: 'icon' })<{ size: number }>(({ size }) => ({
      width: size,
    }))
    const Button = styled('button', { name: 'Button' })`
      ${Icon} {
        margin-right: 4px;
      }
      &:hover ${Icon} {
        opacity: 0.8;
      }
    `

    render(
      <Button>
        <Icon size={16} />
        Save
      </Button>
    )
    expect(String(Icon)).toBe('.icon')
    const button = screen.getByText('Save').className
    expect(sheet.rules).toContain(`@layer umber-components{.${button} .icon{margin-right:4px;}}`)
    expect(sheet.rules).toContain(`@layer umber-components{.${button}:hover .icon{opacity:0.8;}}`)
  })

  it('names the steps of a keyframes template', () => {
    const { keyframes } = setup()
    const fade = keyframes`
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    `
    expect(fade).toBe(keyframes({ from: { opacity: 0 }, to: { opacity: 1 } }))
  })
})
