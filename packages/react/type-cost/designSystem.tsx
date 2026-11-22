// The shapes of a design system that costs the type checker most, for `check-type-cost.mjs`: a base
// component whose props are the HTML attributes of an element and groups of style props (several hundred
// members), a wrapper of `styled` with the five overloads that such an app writes, twenty components
// styled from the base with options, some with props that extend the base's and some with a few of their
// own, and an element of each. It is compiled, never run: `pnpm typecheck` counts what the checker does.
import type {
  ComponentClass,
  ComponentProps,
  ComponentType,
  ElementType,
  HTMLAttributes,
  JSX,
  ReactNode,
  Ref,
} from 'react'
import {
  styled as baseStyled,
  type CreateStyled,
  type CreateStyledComponent,
  type FilteringStyledOptions,
  type Interpolation,
  type PropsOf,
  type StyledOptions,
} from '../src/index'

interface AppTheme {
  space: string[]
  colors: Record<string, string>
  radii: Record<string, string>
}

/** The options the wrapper adds: the key of the component in the theme, and styles that come last. */
interface CustomizationOptions {
  name?: string
  systemProps?: ReadonlyArray<Interpolation<never>>
}

type Tags = {
  [Tag in keyof JSX.IntrinsicElements]: CreateStyledComponent<
    { theme?: AppTheme; as?: ElementType },
    JSX.IntrinsicElements[Tag]
  >
}

interface AppStyled extends Tags {
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

const styled = baseStyled as CreateStyled as unknown as AppStyled

/** A filter that is not a type guard, as the helpers of style props return. */
const shouldForwardProp = (prop: string): boolean => !prop.startsWith('$')

type Responsive<T> =
  | T
  | null
  | readonly (T | null)[]
  | { readonly [breakpoint: string]: T | undefined }
type Side = '' | 'Top' | 'Right' | 'Bottom' | 'Left' | 'X' | 'Y' | 'Block' | 'Inline'

/** A group of style props, one for each side: `margin`, `marginTop`, ... */
type StyleGroup<Prefix extends string> = { [K in `${Prefix}${Side}`]?: Responsive<string | number> }

interface ViewProps
  extends
    Omit<HTMLAttributes<HTMLElement>, 'color'>,
    StyleGroup<'margin'>,
    StyleGroup<'padding'>,
    StyleGroup<'border'>,
    StyleGroup<'borderWidth'>,
    StyleGroup<'borderColor'>,
    StyleGroup<'inset'>,
    StyleGroup<'scrollMargin'>,
    StyleGroup<'scrollPadding'>,
    StyleGroup<'gap'>,
    StyleGroup<'size'> {
  bg?: keyof AppTheme['colors']
  color?: keyof AppTheme['colors']
  radius?: keyof AppTheme['radii']
}

const View = styled('div', { name: 'View', shouldForwardProp })<ViewProps>()

interface FlexProps extends ViewProps {
  direction?: Responsive<'row' | 'column'>
  isInline?: boolean
}

const Flex = styled(View, { name: 'Flex', shouldForwardProp })<FlexProps>(({ isInline }) => ({
  display: isInline ? 'inline-flex' : 'flex',
}))

// Components whose props extend the base's: every key of theirs is a key of the base too.
interface CardProps extends FlexProps {
  elevation?: number
}
interface PanelProps extends FlexProps {
  isOpen: boolean
}
interface BarProps extends FlexProps {
  position?: 'top' | 'bottom'
}
interface ListProps extends FlexProps {
  isDense?: boolean
}
interface ToolbarProps extends FlexProps {
  isWrapped?: boolean
}
interface SectionProps extends FlexProps {
  level?: 1 | 2 | 3
}

const Card = styled(Flex, { name: 'Card', shouldForwardProp })<CardProps>(
  ({ theme, elevation = 1 }) => ({ boxShadow: `0 ${elevation}px 2px ${theme.colors.shadow}` })
)
const Panel = styled(Flex, { name: 'Panel', shouldForwardProp })<PanelProps>(({ isOpen }) => ({
  display: isOpen ? 'flex' : 'none',
}))
const Bar = styled(Flex, { name: 'Bar', shouldForwardProp })<BarProps>(({ position }) => ({
  [position === 'bottom' ? 'bottom' : 'top']: 0,
}))
const List = styled(Flex, { name: 'List', shouldForwardProp })<ListProps>(({ theme, isDense }) => ({
  gap: isDense ? theme.space[0] : theme.space[2],
}))
const Toolbar = styled(Flex, { name: 'Toolbar', shouldForwardProp })<ToolbarProps>(
  ({ isWrapped }) => ({ flexWrap: isWrapped ? 'wrap' : 'nowrap' })
)
const Section = styled(Flex, { name: 'Section', shouldForwardProp })<SectionProps>(
  ({ theme, level = 1 }) => ({ paddingTop: theme.space[level] })
)

// Components with a few props of their own, which the base does not have.
const Badge = styled(Flex, { name: 'Badge', shouldForwardProp })<{ tone?: 'info' | 'danger' }>(
  ({ theme, tone = 'info' }) => ({ backgroundColor: theme.colors[tone] })
)
const Chip = styled(Flex, { name: 'Chip', shouldForwardProp })<{ isSelected: boolean }>(
  ({ isSelected }) => ({ fontWeight: isSelected ? 700 : 400 })
)
const Avatar = styled(Flex, { name: 'Avatar', shouldForwardProp })<{ diameter: number }>(
  ({ diameter }) => ({ width: diameter, height: diameter })
)
const Divider = styled(Flex, { name: 'Divider', shouldForwardProp })<{ isVertical?: boolean }>(
  ({ theme, isVertical }) => ({ [isVertical ? 'width' : 'height']: theme.space[0] })
)
const Tag = styled(Flex, { name: 'Tag', shouldForwardProp })<{ isRemovable?: boolean }>(
  ({ isRemovable }) => ({ paddingRight: isRemovable ? 4 : 8 })
)
const Callout = styled(Flex, { name: 'Callout', shouldForwardProp })<{ accent: string }>(
  ({ theme, accent }) => ({ borderLeftColor: theme.colors[accent] })
)
const Step = styled(Flex, { name: 'Step', shouldForwardProp })<{ isDone: boolean }>(
  ({ isDone }) => ({ opacity: isDone ? 0.6 : 1 })
)
const Meter = styled(Flex, { name: 'Meter', shouldForwardProp })<{ ratio: number }>(
  ({ ratio }) => ({ backgroundSize: `${ratio * 100}% 100%` })
)
const Notice = styled(Flex, { name: 'Notice', shouldForwardProp })<{ isSticky?: boolean }>(
  ({ isSticky }) => ({ position: isSticky ? 'sticky' : 'static' })
)
const Pill = styled(Flex, { name: 'Pill', shouldForwardProp })<{ isOutlined?: boolean }>(
  ({ theme, isOutlined }) => ({ borderRadius: theme.radii.round, borderWidth: isOutlined ? 1 : 0 })
)
const Frame = styled(Flex, { name: 'Frame', shouldForwardProp })<{ ratio?: string }>(
  ({ ratio = '16 / 9' }) => ({ aspectRatio: ratio })
)
const Rail = styled(Flex, { name: 'Rail', shouldForwardProp })<{ isCollapsed: boolean }>(
  ({ theme, isCollapsed }) => ({ width: isCollapsed ? theme.space[4] : theme.space[8] })
)
const Slot = styled(Flex, { name: 'Slot', shouldForwardProp })<{ area: string }>(({ area }) => ({
  gridArea: area,
}))
const Well = styled(Flex, { name: 'Well', shouldForwardProp })<{ isInset?: boolean }>(
  ({ theme, isInset }) => ({ padding: isInset ? theme.space[3] : theme.space[1] })
)

/** An element of each component, given props of the base and its own. */
export function DesignSystem({
  children,
  ...rest
}: Readonly<FlexProps & { children?: ReactNode }>) {
  return (
    <View {...rest}>
      <Card elevation={2} {...rest} />
      <Panel isOpen {...rest} />
      <Bar position="bottom" as="header" {...rest} />
      <List isDense {...rest} />
      <Toolbar isWrapped {...rest} />
      <Section level={2} {...rest} />
      <Badge tone="danger" marginTop={1} />
      <Chip isSelected padding={2} />
      <Avatar diameter={32} title="avatar" />
      <Divider isVertical />
      <Tag isRemovable bg="surface" />
      <Callout accent="info" role="note" />
      <Step isDone />
      <Meter ratio={0.5} />
      <Notice isSticky />
      <Pill isOutlined />
      <Frame ratio="4 / 3" />
      <Rail isCollapsed={false} />
      <Slot area="main" />
      <Well isInset>{children}</Well>
    </View>
  )
}
