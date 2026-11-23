# The style memo

After this page you can decide whether to turn on `hasStyleMemo`, turn it on where your app makes its styles, and say what it costs, what could go wrong with it, and what has not been checked.

## What it is

`hasStyleMemo` is an option of the cache, off by default. With it on, a cache recognises a style it has made before from its contents, and skips the compile and the hash that would name its class again. The classes, the rules and their order are the same with it on and off.

## The problem it solves

A component often writes a condition in its style. Through `styled`, as a function of props:

```tsx
const style = createStyle(theme, { prefix: 'memo', hasStyleMemo: true })
const Title = style.styled('h1')<{ isMobile: boolean }>(({ isMobile }) => ({
  fontSize: isMobile ? 12 : 48,
}))
```

And through `css` of `@umber-style/css`:

```ts
const { css } = createInstance({ key: 'title', hasStyleMemo: true })
const title = (isMobile: boolean) => css({ fontSize: isMobile ? 12 : 48 })
title(true) // compiled and named
title(true) // compiled again, and remembered
title(true) // found by its contents: not compiled
```

(`styleMemo.docs.test.tsx` of the React binding and `createInstance.memo.test.ts` of `@umber-style/css`, which also check that each call gives the class the option off gives.)

Every render of `<Title isMobile />` and every call of `title(true)` makes a new object with one of two contents. The cache has never seen that object. Without the memo it merges the style, compiles it to its rules, and hashes the rules into a class name; only then does it find that it has the class, and it writes nothing. It does that on every render, to learn nothing new. Using the object itself as the key was rejected: an object that an app keeps and changes after its first use would keep the class of what it held at first.

With the memo, the cache still merges the style, then follows its keys in order, each with its value, through a tree of lookups: one step for each key and value, one level down for a nested style. If the steps end at a class, that is the class, and the compile and the hash are skipped. Nothing is joined into a text: a key with its value is one step, and the number `1` and the string `'1'` are two different steps.

A found class is not a shortcut past the rest of the call. The merge runs, the class is registered with the style of this call, and its rule is written when the sheet lacks it, on every call, as without the memo.

## How to turn it on

The option goes where the cache is made. Each line below is copied from a test that passes with it.

| Where                             | How                                                                            | Test                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| The default style (React)         | `configure({ prefix: 'on', hasStyleMemo: true })`                              | `styleMemo.docs.test.tsx`: "by configure, on the default style"                                                              |
| A style of its own (React)        | `createStyle(theme, { prefix: 'memo', hasStyleMemo: true })`                   | `styleMemo.docs.test.tsx`: "by createStyle: a function of props has the class it has without it"                             |
| A cache of the core               | `createCache({ prefix: 'm', sheet: createMemorySheet(), hasStyleMemo: true })` | `cache.memo.test.ts`: "finds the same contents in a new object, and tells a string from a number"                            |
| An engine that makes its cache    | `createEngine({}, { prefix: 'e', hasStyleMemo: true })`                        | `cache.memo.test.ts`: "is made by the option, of the cache and of an engine that makes its cache"                            |
| A cache of `@umber-style/cache`   | `createCache({ key: 'page', hasStyleMemo: true })`                             | `index.node.test.ts` of `@umber-style/cache`: "takes the memo of contents, hasStyleMemo, and names what it names without it" |
| An instance of `@umber-style/css` | `createInstance({ key: 'title', hasStyleMemo: true })`                         | `createInstance.memo.test.ts`: "names a style with a condition as without the memo"                                          |

Under a `CacheProvider` the cache of the provider decides, for its subtree. Here the default style has no memo, and the subtree has one:

```tsx
const cache = createCache({ prefix: 'page', hasStyleMemo: true })
const wrap = (node: ReactNode) => <CacheProvider value={cache}>{node}</CacheProvider>
```

The other way round holds too: an engine given a `cache` uses that cache's memo, or none. `createStyle(theme, { cache: without, hasStyleMemo: true })`, over a cache made without the option, has no memo (`styleMemo.docs.test.tsx`, "by the cache of a CacheProvider, which decides for its subtree"; see [Options reference](options.md), where `hasStyleMemo` is one of the options that are the cache's).

Vue's `createStyle` and `configure` pass their options to the engine in the same way. React Native has no class cache: there the option is accepted so that one call runs on both platforms, does nothing, and is named in a warning in development.

## Where it helps, and where it does nothing

It helps a style made of strings and numbers, nested rules included, at any depth, that comes back with the same contents in a new object:

| Case                                                            | Why it helps                                                            | Measured, memo off to on (one operation)      |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| A condition in a style, `css({ fontSize: isMobile ? 12 : 48 })` | Two contents, a new object on every call                                | 475 ns to 84 ns, one `css()` call             |
| A few variants chosen by props, used on many elements           | Each element's props class is the same few contents again               | 69.6 us to 40.2 us, 48 elements of 2 variants |
| Values read from the theme                                      | A token is a `var(--name)` string, the same in every render             | not measured apart                            |
| A list whose rows use a handful of combinations                 | The rows repeat the same contents                                       | 1.66 ms to 1.16 ms, the tree of 500           |
| A nested style (`'&:hover': { ... }`, a media query)            | Nested styles of strings and numbers are covered                        | 1.34 us to 421 ns, a nested style one of four |
| A plain object in `style`, rendered on a server                 | On a server it is a class of the overrides layer, made by the same path | 95.9 us to 57.1 us, 48 elements               |

The figures are from the comparison run of 0.4.0 (round 2, five rounds, one CPU; [Performance](performance.md#with-the-style-memo-off-and-on) has every row). The rows of 48 elements and the tree are rendered to a string, warm, markup only. In the repository's own file, which renders a style element beside each class, the gain is smaller: 22% less time for 48 elements of 2 variants, 20% for 48 of 48 combinations and for the tree of 500 (`string-props.bench.ts`, nine rounds).

It does nothing for the cases below, and costs nothing that the benchmarks could measure there:

| Case                                                                                                                             | Why it does nothing                                                                                                                                                                                  | Measured, memo off to on                   |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| A value that never repeats, `css({ left: x })`, a new `x` each call                                                              | No two calls have the same contents. For a value that changes on every frame, [`useStyleValue`](writing-styles.md#a-value-that-changes-without-a-render) writes one class and changes a CSS variable | 1.35 us and 1.28 us: level                 |
| The first time a style is seen                                                                                                   | A style is remembered the second time its class is made, never the first                                                                                                                             | new small style 2.83 us and 2.79 us: level |
| A first render over a fresh cache                                                                                                | A memo belongs to one cache and starts empty; only a style that comes three times or more in that one render is found                                                                                | 1.06 to 1.16 times faster, one row level   |
| A class name or a sheet entry among the inputs                                                                                   | The call takes the full path, as without the option                                                                                                                                                  | not measured apart                         |
| A list of fallback values, an `alpha()` value, a live value of `useStyleValue`, a function, an object that is not a plain object | Not a plain value: the call takes the full path, and is not remembered                                                                                                                               | not measured apart                         |
| A plain object in `style` in the browser                                                                                         | There it makes a held class (`cssHeld`), which elements hold and release, and which the memo does not cover                                                                                          | not measured                               |

Why the second time and not the first: a first version remembered a style the first time it was seen, and that made every new style pay for remembering it, a copy of its nested styles and a step of the tree for each key. Measured in the sandbox, one CPU: a new large style went from 34 us to 89 us, a new small one from 4.1 us to 5.1 us, and 48 elements over a fresh cache from 545 us to 661 us. Whether a class was made before the call is known for free once it is named, so a style that comes only once now pays a walk that stops at the first key or value the memo does not have.

### When there is no memo even with the option on

- **With the development checks on.** `hasDevChecks` is on by default when `process.env.NODE_ENV` is `development` and there is a `document`, so a development build in the browser has no memo; `hasDevChecks: true` turns them on, and the memo off, anywhere, a test run and a production build included. Every call is then checked, as before. A development server render, which has no `document`, has the memo unless `hasDevChecks: true` is given.
- **With value repair on.** A set of style options with `hasValueRepair: true` has no memo: a repaired value reads the values of the tokens, which change. This holds for a cache made with it, and for a view `cache.withStyleOptions({ hasValueRepair: true })`, which is what an engine given `hasValueRepair: true` over a cache writes through; the cache's own options may still have a memo.

(`cache.memo.test.ts`: "is not used with the development checks, which warn on every call as before" and "is not used with value repair, whose compile reads the values of the tokens".)

## What it costs

**Memory.** A memo holds at most 10,000 steps (a step is one key with its value) for each set of style options of a cache. When it is full, the next style it remembers empties it first, and it fills again from the calls that follow. Its size at the cap depends on where styles differ. Measured on the host with `--expose-gc`, each style made twice so that it is remembered, the heap of a cache with the memo less the heap of one without:

| Styles                                                                       | Held at the cap |
| ---------------------------------------------------------------------------- | --------------: |
| They differ early in their keys (`{ left: n, ...small }`)                    |    about 3.5 MB |
| The large style with a new `zIndex`                                          |      about 4 MB |
| They differ in one value at the end (`{ ...small, left: n }`, `{ left: n }`) |    under 0.5 MB |

After the cap it stays flat: 20,000 and 40,000 styles held what 10,000 held. The memory allocated by one call was within the benchmark tool's noise on every row.

**Code.** The code of the memo is part of the cache, so it is in every bundle of the core, whether the option is on or off. All exports of the core, bundled with esbuild 0.25.12: 79.7 KB minified and 29.3 KB gzipped before it, 81.7 KB and 30.1 KB after, so 0.8 KB gzipped.

**Time where it cannot help.** A call it covers pays one walk of the contents of its merged style. When the walk finds nothing, the call takes the full path as before, plus one lookup of the class once it is named. The rows of the table above that say "level" are that cost.

## Risks

With the option off none of the risks below can happen: the cache does the full work on every call, as it did before the option existed, and a test proves that no memo is made then ("is off by default: no memo is made and the path of every call is the one without it"). The memo is what brings them in. Each one below is closed by a guard, and a test checks the guard; the one case that has no guard is under [Known issues](#known-issues).

Two kinds of failure are possible, and they are what a user would see:

- An element has a class whose rule is not in the page. It looks unstyled.
- An element has the class of another style. It has the wrong size, colour or order of rules.

A hit skips only the compile and the hash. The merge, the registration of the class and the writing of its rule still run on every call. So four of the risks below cannot happen by construction, those that end in a class with no rule (two caches, a rule removed, the second page, hydration): whatever class the memo names, the call registers it in this cache and writes its rule when the sheet lacks it. The tests are there to keep it so. The others, which end in the class of another style, needed a guard of their own.

| Risk, as a user would see it                                                                                                                                              | How it could come about                                                                                                                                                                    | Guard                                                                                                                                                                                                                                              | Tests (core, `cache.memo.test.ts` unless named)                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An unstyled element on the page of one request, or under a `CacheProvider`                                                                                                | A memo shared by two caches names a class that only the other cache wrote                                                                                                                  | By construction: a memo belongs to one cache, and every call registers its class and writes its rule when the sheet lacks it                                                                                                                       | "answers for one cache only: a fresh cache writes the rule and its page has it"                                                                                                                                                                                                                                                                                 |
| The class of another style, through a second set of style options over one cache                                                                                          | Two views with other options (`hasVendorPrefixes`, `hasColorFallbacks`) share a memo                                                                                                       | One memo for each set of style options                                                                                                                                                                                                             | "answers for one view only: two engines over one cache write what each view writes"                                                                                                                                                                                                                                                                             |
| An unstyled element after a rule was removed                                                                                                                              | The cache let a rule go (a held class released, a sheet emptied by `flush()`), and the memo still names the class                                                                          | By construction: the memo holds names only, and the call writes the rule when the sheet lacks it. A held class is never remembered, and a class the memo named is registered for good                                                              | "writes the rule of a held class let go when the same contents come again", "keeps for good a class it named, which a holder that comes later cannot take away", "marks the variables of a rule as the full path does, with pruning"; `@umber-style/css`, `createInstance.memo.test.ts`: "writes the rule again after flush, when the same contents come again" |
| An unstyled element on the second page a server renders                                                                                                                   | The CSS of a page is extracted from what the cache registered, and a hit skipped the registration                                                                                          | By construction: every call registers its class                                                                                                                                                                                                    | "serves every page of a cache: the second page of the same contents has the rule"                                                                                                                                                                                                                                                                               |
| A rule written twice after hydration, or an unstyled element after the server's style element is removed                                                                  | The memo trusts what the page had, or what it had before it changed                                                                                                                        | By construction: the memo starts empty in the browser and does not decide what is written; the page's rules are marked as before                                                                                                                   | `cache.memo.page.test.ts`: "writes no second rule for a class the page has, and names it as the server did", "does what the cache does without it once the page loses the element"                                                                                                                                                                              |
| The wrong size: `{ width: 1 }` is `1px`, `{ width: '1' }` stays `1`                                                                                                       | A number and the string of its text taken as one value                                                                                                                                     | The values are keys of a `Map`, not text: `1` and `'1'` are two steps. `-0` and `0` are one step, and the compiler writes them the same                                                                                                            | "gives a number and a string of the same text what the full path gives each"; `contentMemo.test.ts`: "tells a number from the string of its text, and finds each as it was remembered"                                                                                                                                                                          |
| The wrong margin: `{ margin: 0, marginLeft: 4 }` is not `{ marginLeft: 4, margin: 0 }`                                                                                    | Keys compared without their order                                                                                                                                                          | The steps follow the keys in order                                                                                                                                                                                                                 | "gives keys in another order what the full path gives each order"; `contentMemo.test.ts`: "tells keys in another order apart"                                                                                                                                                                                                                                   |
| Wrong declarations: `{ a: 'b;c:d' }` taken for `{ a: 'b', c: 'd' }`                                                                                                       | Keys and values joined into a text whose separators a value can hold                                                                                                                       | Nothing is joined: a key and its value are one step                                                                                                                                                                                                | "gives a value that looks like more declarations what the full path gives"; `contentMemo.test.ts`: "joins no text, so a value that looks like more declarations is one value", "tells a nested style from keys of the same names at the top"                                                                                                                    |
| An override that loses, a class with the wrong label, or a props class in the wrong order                                                                                 | The same contents in another layer, with another label, or after another class                                                                                                             | The layer and the class it comes after are the root of the walk; the label is a key of the merged style                                                                                                                                            | "keeps each layer, label and class to come after apart"; `contentMemo.test.ts`: "keeps a style apart for each layer and each class it is made after"                                                                                                                                                                                                            |
| A later merge of the class name misses part of this call's style                                                                                                          | Two styles with the same rules differ in what writes no rule (`undefined`, `null`, `false`, an empty nested style, a label, `web`, `native`), and a hit keeps the style of an earlier call | The merge runs on every call, and the class is registered with this call's style                                                                                                                                                                   | "gives the style of the last call to a later merge, also for what writes no rule"                                                                                                                                                                                                                                                                               |
| The wrong colour or value from an `alpha()` value, a live value, an object with its own `toString`, a list, a getter, a key of the prototype, a symbol key or `__proto__` | The memo keys a value that is not plain data, or reads a getter that gives another value the next time                                                                                     | Only strings, numbers, `undefined`, `null`, `false` and nested plain objects are walked; anything else takes the full path and is not remembered; a nested style is read through its property descriptors, so a getter is never called by the memo | "takes the full path for what is not a plain value, and gives what it gives", "takes the full path for class names, entries, lists and nothing at all", "reads a getter as many times as the full path does, and gives what it gives"; `contentMemo.test.ts`: "calls no getter of a nested style, and reads no style that has one"                              |
| The wrong class, or no rule, after the memo was full                                                                                                                      | Entries that left the memo, or a memo that grows without end                                                                                                                               | Emptied when full; the next call takes the full path and is registered as always                                                                                                                                                                   | "names the right class after it was emptied, with the rule in the sheet"; `contentMemo.test.ts`: "is emptied when it holds the most steps it may, and goes on remembering"                                                                                                                                                                                      |
| A warning that does not come, or a repaired value read from old token values                                                                                              | The memo used with the development checks or with value repair                                                                                                                             | No memo with either                                                                                                                                                                                                                                | "is not used with the development checks, which warn on every call as before", "is not used with value repair, whose compile reads the values of the tokens"                                                                                                                                                                                                    |

Beyond the cases one by one, a generated comparison runs 400 styles in 2000 calls, under three sets of options (the defaults; layers and labels off; vendor prefixes off), on a cache with the memo and one without: every class, rule, registered style and page is the same ("gives every class, rule, registered style and page of the full path, on generated styles"). The styles mix plain values with nested styles, lists, `alpha()` values, empty nested styles, labels, keys that hold `;` and `:`, and numbers next to the strings of their text. In the React binding a tree of rows chosen by props and cells with a function of the theme renders the same markup and the same CSS with the memo on and off, on the server (`styleMemo.ssr.test.tsx`) and in a document of jsdom (`styleMemo.test.tsx`).

### How the guards were checked

A script broke the memo on purpose in 13 ways, one at a time, ran the tests of the core and of `@umber-style/css` against each, and restored the source. Each break made at least one test fail:

| Break                                              | Tests that failed |
| -------------------------------------------------- | ----------------: |
| The memo on by default                             |                 1 |
| One memo for every cache                           |                 5 |
| Held classes remembered, and a hit not registered  |                 1 |
| A hit that ignores what the page has               |                10 |
| A number and its text as one value                 |                 4 |
| Keys sorted                                        |                 2 |
| Keys and values joined as text                     |                 9 |
| The layer and the class it comes after ignored     |                 3 |
| A hit that does not register the style of its call |                 5 |
| Nested values read with their getters              |                 1 |
| Never emptied                                      |                 1 |
| Used with the development checks                   |                 1 |
| Used with value repair                             |                 1 |

Not every test failed under some break: see [Known issues](#known-issues).

## Known issues

- **A nested style that is a `Proxy` whose descriptor trap and get trap disagree is not detected.** The memo reads a nested style through its property descriptors; the compiler reads it through its values. If the two answer differently, the memo can remember the class of what the compiler read under the contents it read itself, and a later style with those contents gets the other style's class: the wrong size or colour. Nothing checks for it. Do not give the engine such a proxy as a nested style, or leave the option off.
- **A plain object in `style` in the browser is not covered.** It makes a held class, which takes the full path on every render with the option on or off. There is no gain there, and no risk.
- **It has not run in a real app.** The option is off by default. It has run in the unit tests of the core, of `@umber-style/css` and of `@umber-style/cache`, in the React render comparisons on the server and in jsdom, and in the benchmarks (the local files and the comparison run). It has not run in a browser, in a fixture app, in Vue's tests, or with streaming or the server components build.
- **One hydration test cannot catch a broken hit.** "writes no second rule for a class the page has, and names it as the server did" makes two calls with the same contents. A style is remembered at its second call, so neither call is a hit, and no break of the hit path changes what the test sees: it failed under none of the 13 breaks. The test beside it, "does what the cache does without it once the page loses the element", makes a third call and failed under the break that ignores the page.
- **Three scenario tests failed under no break**: "answers for one cache only", "serves every page of a cache" and, in `@umber-style/css`, "writes the rule again after flush". The memo never decides what is registered or written; every call registers its class and writes its rule when the sheet lacks it. No plausible break of the memo reaches that, so these tests guard the construction, not the memo.
- **Other tests failed under no break either.** In `cache.memo.test.ts`: "keeps for good a class it named", "marks the variables of a rule as the full path does, with pruning" and "takes the full path for class names, entries, lists and nothing at all". In `contentMemo.test.ts`: "finds a style of equal contents in a new object", "finds a number by its value: 1.0 is 1, and -0 is 0", "remembers a style with no rule as the empty class", "finds nothing for values it does not read", and the four tests of `readStableStyle`. The tests of the React binding were not run against the breaks.
- **A style seen once costs a walk, and the second time it costs the remembering.** A style whose contents never repeat pays the walk on every call. Measured, both are within 5% of the option off.
- **A full memo is emptied, not trimmed.** After the 10,000th step the next style it remembers empties all of it, and the styles in use are found again only from their second call after that. An app with more distinct contents than the cap holds keeps refilling it.

## When to turn it on, and when not

| Your app                                                                                                                 | Turn it on?                 | Why                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Many components whose class depends on props, rendering again and again over a long-lived server process or in a browser | Yes                         | The same contents come back render after render: 20% to 42% less time for the renders measured                                                       |
| A process that starts fresh for each request, or a cache made for each request                                           | Little to gain              | A fresh cache starts with an empty memo; a first render hits only on styles that come three times or more in it (1.06 to 1.16 times faster measured) |
| A suite of tests with the development checks on                                                                          | No                          | There is no memo with the development checks                                                                                                         |
| A library that wraps the engine                                                                                          | Leave the choice to the app | It costs memory for each cache, and the app knows whether its renders repeat                                                                         |

The option adds 0.8 KB gzipped to the core whether it is on or not, so leaving it off saves no code.

## Limits

- No browser was measured: the times are of Node in a Docker sandbox, one CPU, rendering to a string, and the memory at the cap was measured on the host. The cost in a browser's memory, and over a long session, is not known.
- Every figure comes from one desktop machine, in use during the runs.
- The option is off by default, and no app outside the repository's tests has run with it on.
- The memory per call and the memory at the cap were measured for the shapes of style named above; another shape of style holds another amount at the cap, up to what 10,000 steps of it hold.
- Vue's `createStyle` and `configure` take the option, as an engine option, but no test turns it on through Vue.
