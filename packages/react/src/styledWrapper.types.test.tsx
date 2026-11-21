// A wrapper of `styled` in the shape that a design system keeps when it moves from the styling library it
// used before, with only the scope of its imports changed: overloads that return `CreateStyledComponent`,
// options typed for a tag or a component, a mapped type of the tag shorthands, and
// `Object.assign(wrapper, styled)`. The app declares its theme as an interface of its own and does not
// merge it into `Theme`, so this file is not compiled with `augmentation.test.tsx`
// (tsconfig.augmentation.json). `pnpm typecheck` compiles it under `strict`; the run checks that the
// components it makes work.
import { render, screen } from '@testing-library/react'
import { createCache, createMemorySheet } from '@umber-style/core'
import {
  Component,
  type ComponentClass,
  type ComponentProps,
  type ComponentType,
  type ElementType,
  type JSX,
  type ReactNode,
  type Ref,
} from 'react'
import { expectTypeOf } from 'vitest'
import {
  configure,
  styled as baseStyled,
  ThemeProvider,
  useTheme,
  type CreateStyled,
  type CreateStyledComponent,
  type FilteringStyledOptions,
  type Interpolation,
  type PropsOf,
  type StyledOptions,
} from './index'

const sheet = createMemorySheet()
configure({ prefix: 'w', cache: createCache({ prefix: 'w', sheet }) })

interface AppTheme {
  name: string
  palette: { primary: string; text: string }
  space: string[]
  components?: Record<string, { styleOverrides?: Record<string, unknown> } | undefined>
}

const appTheme: AppTheme = {
  name: 'light',
  palette: { primary: '#0000ff', text: '#111111' },
  space: ['0px', '4px', '8px'],
  components: { Box: { styleOverrides: { root: { margin: '2px' }, title: { margin: '3px' } } } },
}

/** The options the wrapper adds: the key of the component in `theme.components`, and styles that come last. */
interface CustomizationOptions {
  name?: string
  slot?: string
  extraStyles?: ReadonlyArray<Interpolation<never>>
}

type WrappedTags = {
  [Tag in keyof JSX.IntrinsicElements]: CreateStyledComponent<
    { theme?: AppTheme; as?: ElementType },
    JSX.IntrinsicElements[Tag]
  >
}

interface WrappedStyled extends WrappedTags {
  <
    C extends ComponentClass<ComponentProps<C>>,
    Forwarded extends keyof ComponentProps<C> & string = keyof ComponentProps<C> & string,
  >(
    component: C,
    options: FilteringStyledOptions<ComponentProps<C>, Forwarded> & CustomizationOptions
  ): CreateStyledComponent<
    Pick<PropsOf<C>, Forwarded> & { theme?: AppTheme },
    object,
    { ref?: Ref<InstanceType<C>> }
  >
  <
    C extends ComponentType<ComponentProps<C>>,
    Forwarded extends keyof ComponentProps<C> & string = keyof ComponentProps<C> & string,
  >(
    component: C,
    options: FilteringStyledOptions<ComponentProps<C>, Forwarded> & CustomizationOptions
  ): CreateStyledComponent<Pick<PropsOf<C>, Forwarded> & { theme?: AppTheme }>
  <C extends ComponentType<ComponentProps<C>>>(
    component: C,
    options?: StyledOptions<ComponentProps<C>> & CustomizationOptions
  ): CreateStyledComponent<PropsOf<C> & { theme?: AppTheme }>
  <
    Tag extends keyof JSX.IntrinsicElements,
    Forwarded extends keyof JSX.IntrinsicElements[Tag] & string = keyof JSX.IntrinsicElements[Tag] &
      string,
  >(
    tag: Tag,
    options: FilteringStyledOptions<JSX.IntrinsicElements[Tag], Forwarded> & CustomizationOptions
  ): CreateStyledComponent<
    { theme?: AppTheme; as?: ElementType },
    Pick<JSX.IntrinsicElements[Tag], Forwarded>
  >
  <Tag extends keyof JSX.IntrinsicElements>(
    tag: Tag,
    options?: StyledOptions<JSX.IntrinsicElements[Tag]> & CustomizationOptions
  ): CreateStyledComponent<{ theme?: AppTheme; as?: ElementType }, JSX.IntrinsicElements[Tag]>
}

const createCustomizable = (
  tag: never,
  options: (StyledOptions & CustomizationOptions) | undefined = {}
) => {
  const { name, slot = 'root', extraStyles = [], ...rest } = options
  const create = baseStyled(tag, rest)
  if (name === undefined) return create
  // The overrides of the component in the theme, after its own styles: a list, as many as apply.
  const themeStyles = (props: Record<string, unknown> & { theme: AppTheme }) => {
    const overrides = props.theme.components?.[name]?.styleOverrides
    if (!overrides) return null
    return [overrides[slot], props.hidden ? { display: 'none' } : null] as Interpolation<never>
  }
  return (...styles: ReadonlyArray<Interpolation<never>>) =>
    create(...styles, themeStyles as Interpolation<never>, ...extraStyles)
}

const styled = Object.assign(
  createCustomizable as unknown as CreateStyled,
  baseStyled
) as unknown as WrappedStyled

/** The rules written so far, as one text. */
const readRules = () => sheet.rules.join('')

describe('a wrapper of styled, typed as a design system types it', () => {
  it('infers the props and the theme of a function style, with no annotation', () => {
    const Box = styled('div', { name: 'Box', label: 'Box' })<{ tone?: 'primary' | 'text' }>(({
      theme,
      tone = 'primary',
      ...props
    }) => {
      expectTypeOf(theme.palette.primary).toEqualTypeOf<string>()
      expectTypeOf(props.id).toEqualTypeOf<string | undefined>()
      return { color: theme.palette[tone], padding: theme.space[1] }
    })
    const Title = styled.h2(({ theme, ...props }) => ({
      color: theme.palette.text,
      fontWeight: props.hidden ? 400 : 700,
    }))
    render(
      <ThemeProvider theme={appTheme}>
        <Box data-testid="box" tone="text" hidden>
          <Title data-testid="title">x</Title>
        </Box>
      </ThemeProvider>
    )
    // @ts-expect-error a prop of the component's own takes its values only
    const wrong = <Box tone="danger" />
    expect(wrong.type).toBe(Box)
    // Every style reads a prop, so the component has one class: the label, then the hash.
    expect(screen.getByTestId('box').className).toMatch(/^w-Box-\w+$/)
    expect(screen.getByTestId('title').tagName).toBe('H2')
    const rules = readRules()
    expect(rules).toContain('color:var(--w-palette-text);padding:var(--w-space-1);')
    // The list that the function of the theme returned: the overrides of the slot, and one by a prop.
    expect(rules).toContain('margin:2px;display:none;')
    expect(rules).toContain('{color:var(--w-palette-text);font-weight:700;}')
  })

  it('narrows the props of a tag and of a component to what a type guard forwards', () => {
    const Link = styled('a', {
      shouldForwardProp: (prop): prop is 'href' | 'children' =>
        prop === 'href' || prop === 'children',
    })<{ isActive?: boolean }>(({ theme, isActive }) => ({
      color: isActive ? theme.palette.primary : theme.palette.text,
    }))
    interface CardProps {
      heading: string
      tone?: string
      className?: string
      children?: ReactNode
    }
    function Card({ heading, className, children }: CardProps) {
      return (
        <section className={className}>
          <h3>{heading}</h3>
          {children}
        </section>
      )
    }
    const Filtered = styled(Card, {
      shouldForwardProp: (prop): prop is 'heading' | 'className' | 'children' => prop !== 'tone',
    })(({ theme, heading }) => ({ padding: heading ? theme.space[2] : 0 }))
    const Plain = styled(Card, { name: 'Card' })(({ theme, tone }) => ({
      color: tone ?? theme.palette.text,
    }))
    render(
      <ThemeProvider theme={appTheme}>
        <Link href="#top" isActive>
          top
        </Link>
        <Filtered heading="filtered" />
        <Plain heading="plain" tone="red" />
      </ThemeProvider>
    )
    // @ts-expect-error `title` is not forwarded, so it is not a prop
    const dropped = <Link title="x" />
    expect(dropped.type).toBe(Link)
    expect(screen.getByText('top').getAttribute('href')).toBe('#top')
    expect(screen.getByText('filtered').parentElement?.className).toMatch(/^w-/)
    expect(readRules()).toContain('{color:red;}')
  })

  it('types the ref of a class component as JSX props of its own', () => {
    class Legacy extends Component<{ label: string; className?: string }> {
      render() {
        return <output className={this.props.className}>{this.props.label}</output>
      }
    }
    const Styled = styled(Legacy, {
      shouldForwardProp: (prop): prop is 'label' | 'className' =>
        prop === 'label' || prop === 'className',
    })(({ theme }) => ({ color: theme.palette.primary }))
    type Props = ComponentProps<typeof Styled>
    expectTypeOf<Props['ref']>().toEqualTypeOf<Ref<Legacy> | undefined>()
    render(
      <ThemeProvider theme={appTheme}>
        <Styled label="legacy" />
      </ThemeProvider>
    )
    expect(screen.getByText('legacy').className).toMatch(/^w-/)
  })

  it('copies the tag shorthands with Object.assign, so the wrapper has them', () => {
    expect(Object.keys(baseStyled)).toContain('div')
    expect(Object.keys(baseStyled)).toContain('foreignObject')
    const Note = styled.aside({ margin: '1px' })
    render(<Note data-testid="note" />)
    expect(screen.getByTestId('note').tagName).toBe('ASIDE')
    expect(readRules()).toContain('{margin:1px;}')
  })
})

describe('ThemeProvider of the default style, given a theme typed by an interface of the app', () => {
  it('takes the theme object, and a function of the theme above typed by the app', () => {
    const seen: string[] = []
    const Probe = () => {
      seen.push((useTheme() as unknown as AppTheme).name)
      return null
    }
    const derive = (outer: AppTheme): AppTheme => ({ ...outer, name: `${outer.name} derived` })
    render(
      <ThemeProvider theme={appTheme}>
        <ThemeProvider theme={derive}>
          <Probe />
        </ThemeProvider>
        <ThemeProvider theme={(outer) => ({ ...outer })}>
          <Probe />
        </ThemeProvider>
      </ThemeProvider>
    )
    expect(seen).toEqual(['light derived', 'light'])
  })
})
