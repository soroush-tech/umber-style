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
}

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
