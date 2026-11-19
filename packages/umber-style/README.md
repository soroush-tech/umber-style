# umber-style

The UmberStyle umbrella: it only re-exports the engine and the bindings as `umber-style`, `umber-style/react`, `umber-style/react-native` and `umber-style/vue`.

Not yet published. Once it is: `pnpm add umber-style`.

```ts
import { styled, ThemeProvider } from 'umber-style/react'
```

## Typed styles

Every entry checks the keys of a style in an object literal, for its own platform:

| Entry                                      | Keys allowed                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `umber-style/vue` and `@umber-style/react` | every CSS property, nested selectors and at-rules, custom properties (`--x`) and `label` |
| `umber-style/react-native`                 | the platform's view, text and image style keys; nothing nested                           |
| `umber-style/react`                        | only the keys that both of them have, with the values that both accept                   |

`umber-style/react` is the entry for code that runs on the web and on React Native. Under the `react-native` export condition it is the React Native binding at run time, and for the compiler the entry is always the same set of types, so one source type-checks the same under both. `display: 'grid'`, a nested selector, `elevation` or `label` at the top level of a shared style is an error.

A shared style has two parts for one platform each, so that a platform-only thing stays visible in the shared code:

```ts
const Card = styled(View)({
  padding: 8,
  web: { '&:hover': { opacity: 0.8 } },
  native: { elevation: 2 },
})
```

On the web `web` is merged over the rest and `native` is dropped; on React Native `native` is merged over the rest and `web` is dropped. `web` takes a web style, `native` takes a native style, so a native-only key inside `web` is an error and the other way round. The types are `SharedStyleObject`, `WebStyleObject` and `NativeStyleObject`.

The shared entry has the names that both bindings have (`styled`, `StyleSheet`, `useStyle`, `apply`, `ThemeProvider`, `useTheme`, `themeClass`, `configure`, `createStyle`, `alpha`). What only the web has (`getEngine`, `engine`, `cache`) is imported from `@umber-style/react`. A tag name such as `'div'` type-checks in shared code and throws on React Native: give `styled` a component there.

To use a key that a type does not know, cast the style to the type of the platform: `style as WebStyleObject`, or `style as NativeStyleObject`. `StyleObject` is the loose type of the engine and is cast the same way.
