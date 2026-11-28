import type { ImageStyle, TextStyle, ViewStyle } from 'react-native'

/** What a style of any one component takes: a view, a text or an image. */
type ComponentStyle = ViewStyle | TextStyle | ImageStyle

type KeyOf<S> = S extends unknown ? keyof S : never

/** The type of `K` in the members of `S` that have it. */
type ValueOf<S, K extends PropertyKey> = S extends unknown
  ? K extends keyof S
    ? S[K]
    : never
  : never

/**
 * A style for React Native: the keys of the platform's view, text and image styles, each with the value
 * type of the platform. Nothing is nested, and there is no `label`: a key that is not the platform's is
 * an error in an object literal.
 */
export type NativeStyleObject = {
  [K in KeyOf<ComponentStyle>]?: ValueOf<ComponentStyle, K>
} & NativeMotionStyle

/**
 * The animation and transition keys of a native style, written as the web writes them (a time as `'1.5s'`,
 * `'300ms'` or a number of milliseconds). They run with the `animated` option of `createStyle` and
 * `configure`; without it they are dropped, with a development warning.
 */
export type NativeMotionStyle = {
  /** The shorthand of the `animation*` keys: `${name} 1.5s ease-in-out infinite`. */
  animation?: string
  /** A name that `keyframes` returned, `none`, or a comma list of them. */
  animationName?: string
  /** How long one cycle takes. */
  animationDuration?: string | number
  /** A named easing, `cubic-bezier(...)` or `steps(...)`. */
  animationTimingFunction?: string
  /** How long before the animation starts. */
  animationDelay?: string | number
  /** A number of cycles, or `infinite`. */
  animationIterationCount?: string | number
  /** `normal`, `reverse`, `alternate` or `alternate-reverse`. */
  animationDirection?: string
  /** `none`, `forwards`, `backwards` or `both`. */
  animationFillMode?: string
  /** `running` or `paused`. */
  animationPlayState?: string
  /** The shorthand of the `transition*` keys: `opacity 200ms ease-out`. */
  transition?: string
  /** The properties that transition, in CSS form or as the platform names them: `background-color` or `backgroundColor`, `all`, `none`. */
  transitionProperty?: string
  /** How long a transition takes. */
  transitionDuration?: string | number
  /** A named easing, `cubic-bezier(...)` or `steps(...)`. */
  transitionTimingFunction?: string
  /** How long before a transition starts. */
  transitionDelay?: string | number
  /** `normal` or `allow-discrete`. */
  transitionBehavior?: string
}

declare const sheetMark: unique symbol

/**
 * The mark that the compiler gives a style the binding registered (an entry of `StyleSheet.create` or of
 * `useStyle`), so that `SheetStyleProp` can tell it from a plain object. It exists for the compiler only:
 * at run time an entry is the platform's registered style, with no mark.
 */
export interface NativeSheetMark {
  readonly [sheetMark]: true
}

/** An entry of a sheet of the binding: a native style that the binding registered, with its mark. */
export type NativeSheetEntry = NativeStyleObject & NativeSheetMark

/** A set of named native styles. */
export type NativeSheetStyles = Record<string, NativeStyleObject>

/** What a style function may return on React Native. */
export type NativeStyleResult = NativeStyleObject | null | undefined | false

/** A native style that is computed from the props and the theme. */
export type NativeStyleFunction<T, P> = (props: P & { theme: T }) => NativeStyleResult

/** A native style object, or a function of the props and the theme; the defaults accept any function. */
export type NativeStyleInput<T = never, P = never> = NativeStyleObject | NativeStyleFunction<T, P>

/**
 * A native sheet given as an object: one style for each name. It is a record of styles with a function
 * left out, so that a function of the theme is not taken for one (the compiler tries the object form first).
 */
export type NativeObjectSheet<K extends string> = Record<K, NativeStyleObject> & { call?: never }

/** What a native sheet is made from: one style for each name, or a function of the theme that returns them. */
export type NativeSheetInput<K extends string, T> =
  | Record<K, NativeStyleObject>
  | ((theme: T) => Record<K, NativeStyleObject>)
