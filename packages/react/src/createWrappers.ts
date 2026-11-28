import { createElement, type ComponentType } from 'react'

/**
 * The statics that a wrapper does not take from the component it wraps: those React reads (a wrapper has
 * its own, and the wrapped component keeps its `defaultProps` and the rest when it renders), those of a
 * function, and those of a component made by `memo` or `forwardRef`.
 */
const OWN_STATICS = new Set<PropertyKey>([
  '$$typeof',
  'arguments',
  'caller',
  'childContextTypes',
  'compare',
  'contextType',
  'contextTypes',
  'defaultProps',
  'displayName',
  'getDefaultProps',
  'getDerivedStateFromError',
  'getDerivedStateFromProps',
  'length',
  'mixins',
  'name',
  'propTypes',
  'prototype',
  'render',
  'type',
])

/**
 * A component that renders `component` with every prop it is given (`ref` too, a prop in React 19) and
 * `name` set to what `useValue` returns, called in its own render. It has the statics of `component`
 * that are not React's, and the display name `label(Name)`.
 */
function wrapComponent(
  component: ComponentType,
  label: string,
  name: string,
  useValue: () => unknown
) {
  function Wrapped(props: object) {
    return createElement(component, { ...props, [name]: useValue() })
  }
  for (const key of Reflect.ownKeys(component)) {
    if (OWN_STATICS.has(key)) continue
    const descriptor = Object.getOwnPropertyDescriptor(component, key) as PropertyDescriptor
    Object.defineProperty(Wrapped, key, descriptor)
  }
  Wrapped.displayName = `${label}(${component.displayName || component.name || 'Component'})`
  return Wrapped
}

/**
 * Makes `withTheme` and `withStyle` over the `useTheme` and `useStyle` of one style: the hooks in the
 * client build, the plain functions of the same names in the server build, which this calls in the same
 * place. Neither reads a context or calls a hook of React of its own.
 */
export function createWrappers(useTheme: () => unknown, useStyle: (sheet: never) => unknown) {
  return {
    withTheme: (component: ComponentType) =>
      wrapComponent(component, 'withTheme', 'theme', useTheme),
    withStyle: (sheet: object) => (component: ComponentType) => {
      const useSheetStyles = () => useStyle(sheet as never)
      return wrapComponent(component, 'withStyle', 'styles', useSheetStyles)
    },
  }
}
