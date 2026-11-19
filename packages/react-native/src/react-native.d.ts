// The part of the platform that this package uses, so that it type-checks without the platform.
declare module 'react-native' {
  export const StyleSheet: {
    create<T extends Record<string, unknown>>(styles: T): T
    flatten(style: unknown): unknown
    compose(first: unknown, second: unknown): unknown
    hairlineWidth: number
    absoluteFill: object
    absoluteFillObject: object
  }
}
