import { createElement, type ReactNode } from 'react'

// The members of the platform that the animation library reads, for the stand-ins of `react-native` in
// the tests (`vitest.react-native.ts` here and in the umbrella re-export them). The library's code runs
// in the tests from its files for the web, over its official mock, and reads from `react-native` exactly
// these names in 4.7.1 and 4.8.0: components it wraps when it is loaded (`View`, `Text`, `Image`,
// `ScrollView`, `FlatList`, and `TextInput` in its performance monitor), `Platform`, `StyleSheet` (which
// the stand-ins have), `TurboModuleRegistry` and `codegenNativeComponent` for its native specs, and, in
// the mock, `Animated` and `processColor`. Nothing here animates or lays out anything.

/** A stand-in for a host component of the platform: it renders its children in an element of `name`. */
function createHost(name: string) {
  const Host = ({ children }: { children?: ReactNode }) => createElement(name, null, children)
  Host.displayName = name
  return Host
}

export const View = createHost('View')
export const Text = createHost('Text')
export const Image = createHost('Image')
export const ScrollView = createHost('ScrollView')
export const FlatList = createHost('FlatList')
export const TextInput = createHost('TextInput')

// The library's code for the web is what runs here, so the platform says it is the web.
export const Platform = {
  OS: 'web',
  select: <T>(choices: { web?: T; default?: T }) => choices.web ?? choices.default,
}

// No native module is built in: the library's specs ask for one and get none.
export const TurboModuleRegistry = { get: () => null, getEnforcing: () => null }

/** A native component of the library's specs, as a host stand-in. */
export const codegenNativeComponent = (name: string) => createHost(name)

export const Animated = { FlatList, ScrollView }

/** A colour as the platform passes it to native code: the stand-in passes it as it is. */
export const processColor = (color: unknown) => color
