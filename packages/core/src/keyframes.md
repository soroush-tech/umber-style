# keyframes.ts

## What it does

`keyframes(steps, options?)` registers an animation and returns its name, `<label>-<hash>`, at once. Nothing
is written to a sheet then. The rest of the file lets the cache use the registry: `isKeyframesName`,
`createKeyframesRule` (the `@keyframes` text of a name) and `findAnimationNames` (which registered names the
`animation` and `animation-name` declarations of some compiled rules use). `readKeyframesSteps` gives the
steps of a name as they were registered, for a platform that runs an animation from its steps and writes no
rule: the animated entry of the React Native binding (`packages/react-native/src/motionSteps.ts`).

## Why it exists

An animation is a global rule that a class refers to by name. The name has to be known when the style is
written, long before any theme or engine may exist, and the same steps must give the same name on the
server, in the browser and in every engine of the process. So the name is a hash of the steps alone, the
steps go into a registry, and the rule is written only when a class that names the animation is inserted.
`cache.ts` finds the names in the rules it writes and asks for the rule; `createEngine.ts`, `styleTypes.ts`
and `templateStyle.ts` use the name and types; `index.ts` exports `keyframes` and its types.

## The logic

```mermaid
flowchart TD
  entry["keyframes(first, options)"] --> tpl{"first is template strings?"}
  tpl -->|yes| parse["parseKeyframesTemplate, then keyframes again"]
  tpl -->|no| label{"label matches the identifier pattern?"}
  label -->|no| errL["throw TypeError"]
  label -->|yes| themed{"steps is a function?"}
  themed -->|yes| stand["call it with a stand-in theme, hash text starts with 'theme:'"]
  themed -->|no| plain["use the steps"]
  stand --> comp
  plain --> comp["compileSteps with fixed naming context"]
  comp --> name["name = label-hash"]
  name --> reg{"name in registry?"}
  reg -->|no| store["registry.set(name, steps)"]
  reg -->|yes| ret
  store --> ret["return name"]
```

`compileSteps` calls `normalizeSteps` first: each key is split on commas, `from` is 0 and `to` is 100, an
offset must be a percentage from 0% to 100%, steps of one offset are merged with the later winning, and the
result is sorted. A stand-in value is turned into its path, and a nested style in a step throws a
`TypeError`. Later, `createKeyframesRule(name, readTheme, context)` compiles the registered steps again with
the cache's own context, reading the real theme only for a function: `readTheme(name)`, so that the engine
can give the function its theme under the name of the animation (guarded, in development).

```mermaid
flowchart TD
  scan["findAnimationNames(rules)"] --> empty{"registry empty?"}
  empty -->|yes| none["return the empty list"]
  empty -->|no| find["next 'animation' in the rule"]
  find --> found{"found?"}
  found -->|no| nextRule["next rule"]
  found -->|yes| starts{"after '{' or ';', then ':' or '-name:'?"}
  starts -->|no| find
  starts -->|yes| semi{"a ';' follows?"}
  semi -->|yes| toSemi["value ends at the ';'"]
  semi -->|no| toEnd["value ends with the rule"]
  toSemi --> words["keep each registered word, once"]
  toEnd --> words
  words --> find
```

`findAnimationNames(rules)` scans compiled rules for `animation` at the start of a declaration (after `{` or
`;`), takes the value up to the next `;` (or to the end of the rule when no `;` follows), and keeps each word
that is a registered name, once. The next search starts after the end of that value, so the scan always moves
forward and ends.

## The data

The registry is a `Map<name, KeyframesInput>` under the shared name `core.keyframes@1`, so every copy of the
core in the process reads one registry. The naming context is fixed: colour fallbacks on, value repair off,
default scoping, so a name does not change with the options of an engine.

## What it guarantees

- Equal steps give the same name; `from`/`to`, a comma list and the order of keys are the same steps.
- A function of the theme is named by the tokens it reads, not by their values (it sees a stand-in theme).
- Nothing is read from the registry in `findAnimationNames` while no name is registered.
- `readKeyframesSteps` returns the very object (or function) that was registered first under a name, never a
  copy, and undefined for a name that `keyframes` did not return.
- Matching is by whole identifier, in nested selectors and at-rules too.

## Decisions

- The hash is of the steps alone, so it does not depend on the theme, the prefix or token options.
- A themed function is hashed with a `theme:` prefix, so it cannot collide with equal literal steps.
- The registry is kept for the process: an engine made later knows names made before it.

## Limits

- A step holds declarations only; a selector or at-rule in it throws.
- `findAnimationNames` is written for compiled rules, whose declarations each end with `;`. For text with
  a value that has no closing `;`, the value runs to the end of the rule, so the words after it (a `}`, a
  later selector) are read as part of it: a registered name there is found, which is the one place such
  text could differ from the compiled form. Before the guard, such a value sent the search back to the start
  of the rule and the call never returned (`ends a value with no closing ; at the end of the rule, and
  returns`).
