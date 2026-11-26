# Performance

After this page you know how fast UmberStyle 0.4.0 is next to 0.3.0 and next to the styling library the design system used before, where it is slower and why, and what the [style memo](style-memo.md) changes. How to run the benchmarks, and what each of the repository's own files measures, is in [Benchmarks](benchmarks.md).

Times are written in `ns` (nanoseconds), `us` (microseconds) and `ms` (milliseconds). "Used before" in a table is the styling library the design system used before.

## In short

- **A page rendered again over a warm cache is faster.** 48 styled elements rendered to a string are between level with Used before and 4.2 times faster; the tree of 500 elements is 1.15 times faster, and 1.64 times with the style memo on.
- **A component whose class does not depend on props is about 4 times faster** than Used before when it renders again: its class is looked up, not built.
- **Merging classes and making a new style are faster**: a merge of two classes 1.56 times, of five 2.06 times; a new small style 1.40 times, a new large one 2.31 times.
- **A change of theme renders nothing.** Sending a page in another theme from a server took 0.11 to 0.13 of the time Used before takes to render it again (measured with 0.3.0).
- **The first render over a fresh cache is slower**: 1.5 to 2.8 times on 48 elements, 3.2 times with nested providers, 1.43 times on the tree of 500.
- **The CSS of one page, read from its HTML, is 2.95 times slower.**
- **It is a larger download**: it adds 32.4 KB, gzipped, to the JavaScript a visitor downloads for a small app, against 10.7 KB: 3.0 times as much.
- **A style seen before, in a new object, is 1.4 to 1.7 times slower** with the defaults. With the style memo on, the same calls are 1.5 to 3.4 times faster than Used before.
- **Against 0.3.0, 0.4.0 is faster or level everywhere**: 1.21 to 23.7 times faster in the gate, and faster or level on every row of the comparison.

## What was measured, and how

- **The sides.** UmberStyle 0.3.0 (`@umber-style/core`, `react`, `css` and `cache`) and Used before (its React, styled, plain-class, cache and server packages, each at its latest release at the time) were installed from npm. UmberStyle 0.4.0 was packed from this tree with `pnpm pack`, as `pnpm smoke:packed` packs it, and installed beside them. React and `react-dom` 19.3.1, one copy for every side. In round 2, 0.4.0 ran twice, with the defaults (the memo off) and with `hasStyleMemo: true`, each under a prefix of its own so that the two shared nothing.
- **Production on every side.** Each file checks it before it measures, and throws otherwise: `NODE_ENV` is `production`, `isDevelopment()` of each core is `false`, React's production builds are loaded, and no `.development.` module is.
- **The sandbox.** soroush-bench 2.2.3 in Docker, pinned to one CPU with 512 MB (`--cpus 1 --cpuset 0 --memory 512m`), five rounds of each file. Each file is one scenario with all its sides, so the sides are measured in the same round of the same process.
- **The figures.** A time is the median of the five rounds of the mean time of one operation. "Times faster" and "times slower" are the median of the ratios of the five rounds, which is not always the ratio of the two times shown; where the two differ by more than 0.15, or point opposite ways, the row says so. "Level" is within 5%.
- **The same work on each side.** The inputs are the repository's own benchmark inputs (`bench/src/`): the same style objects, the same small theme, the same 48 prop combinations, the same tree of 500 (100 rows chosen by props, of four cells that read the theme), a label on every component. Each side is used as its own documentation says. "Warm" means a cache made warm by a render before the measurement; "cold" means a fresh cache for every render. The server cache of Used before keeps what it compiled in a memo of the whole process, by the key of the cache, so a fresh cache of it compiles nothing that an earlier cache of the same key compiled. That is its real behaviour on a server, and it is in every cold row.
- **Rendering to a string in Node.** Nothing ran in a browser.
- **Two rounds.** Round 1 measured 0.4.0 after its speed work against 0.3.0 and Used before; round 2 measured the style memo off and on. Each table says which round it is from.

## Against 0.3.0

The gate of the repository builds 0.3.0 from its git tag and runs it beside this version, in one sandbox, five rounds (round 2, the memo off). It fails a case slower than 1.25 times 0.3.0; every case passed.

| One operation                                                      |   0.3.0 |   0.4.0 | 0.4.0 is          |
| ------------------------------------------------------------------ | ------: | ------: | ----------------- |
| `cache.css(style)` of the same small style again                   | 1.34 us |  943 ns | 1.42 times faster |
| `cache.css(a, b, c, d, e)` of five classes it made                 | 7.14 us |  301 ns | 23.7 times faster |
| `cache.css(style)` of a small style it has not seen                | 4.04 us | 3.28 us | 1.23 times faster |
| `cache.css(style)` of a large style it has not seen                | 32.5 us | 22.5 us | 1.44 times faster |
| The CSS of one page of ten, 300 elements                           |  154 us |  127 us | 1.21 times faster |
| A theme class of the large theme the engine has not seen           |  431 us |  252 us | 1.71 times faster |
| `createTokens` and `declare` of the large theme (about 280 tokens) | 1.23 ms |  675 us | 1.82 times faster |

The largest change is the merge of classes, which 0.4.0 remembers instead of merging, compiling and hashing again. A style seen before is no longer compiled a second time for its selector. The serializer, the tokens of a theme and the scan of a page's HTML do less work. The rules, the class names, their order and the warnings are the same as in 0.3.0.

In the comparison run, where 0.3.0 and 0.4.0 also render components, 0.4.0 with the defaults was faster than 0.3.0 or level on every row: 1.07 to 2.56 times faster where it differed, and 11.5 and 11.7 times on the two merges.

## With the style memo off and on

The memo is off by default. What it is, how to turn it on, and its risks are on [its own page](style-memo.md). Round 2, the comparison run, UmberStyle 0.4.0 alone.

The call of the owner's case, and others like it: one operation is one `css()` call of a style in a new object.

| One operation                                                           | Memo off | Memo on | What changed                                         |
| ----------------------------------------------------------------------- | -------: | ------: | ---------------------------------------------------- |
| A condition, `{ fontSize: isMobile ? 12 : 48 }`, the two values in turn |   475 ns |   84 ns | 5.88 times faster                                    |
| The small style, one of four in turn                                    |  1.06 us |  338 ns | 3.06 times faster                                    |
| The large style, one of four in turn                                    |  9.68 us | 4.10 us | 2.35 times faster                                    |
| A nested style, one of four in turn                                     |  1.34 us |  421 ns | 3.17 times faster                                    |
| The same small style again                                              |   981 ns |  261 ns | 3.77 times faster                                    |
| The same large style again                                              |  9.26 us | 3.91 us | 2.34 times faster                                    |
| A style that never repeats, `{ left: n }`                               |  1.35 us | 1.28 us | level                                                |
| A new small style (first sight)                                         |  2.83 us | 2.79 us | level                                                |
| A new large style (first sight)                                         |  23.1 us | 22.3 us | level                                                |
| A merge of two classes                                                  |   519 ns |  747 ns | level (noisy: by the times alone, 1.44 times slower) |
| A merge of five classes                                                 |   694 ns |  687 ns | level                                                |

Components rendered to a string. One operation is one `renderToString` of the whole set: 48 elements, or the tree of 500.

| One render                                           | Memo off | Memo on | What changed                                         |
| ---------------------------------------------------- | -------: | ------: | ---------------------------------------------------- |
| 48 elements, 2 variants by a prop, warm              |  69.6 us | 40.2 us | 1.65 times faster, 42% less time                     |
| 48 elements, 48 combinations of props, warm          |   111 us | 66.5 us | 1.67 times faster, 40% less time                     |
| 48 elements, a plain object in `style` on each, warm |  95.9 us | 57.1 us | 1.68 times faster, 40% less time                     |
| 48 elements, fixed styles, warm                      |  20.1 us | 20.3 us | level                                                |
| 48 elements, a function of the theme, warm           |  20.6 us | 21.2 us | level                                                |
| The tree of 500, warm, markup only                   |  1.66 ms | 1.16 ms | 1.43 times faster, 30% less time                     |
| The tree of 500, warm, with its CSS                  |  1.58 ms | 1.20 ms | 1.34 times faster, 24% less time                     |
| Providers three deep over 48 elements, warm          |  81.1 us | 78.7 us | level                                                |
| 48 elements, fixed styles, cold                      |   161 us |  145 us | 1.12 times faster                                    |
| 48 elements, a function of the theme, cold           |   214 us |  354 us | level (noisy: by the times alone, 1.65 times slower) |
| 48 elements, 48 combinations, cold                   |   586 us |  467 us | 1.06 times faster (noisy)                            |
| 48 elements, a plain object in `style`, cold         |   262 us |  216 us | 1.16 times faster                                    |
| The tree of 500, cold, with its CSS                  |  2.28 ms | 1.94 ms | 1.16 times faster                                    |
| The tree of 500, with no set-up (the default style)  |  2.70 ms | 2.24 ms | 1.20 times faster                                    |
| Providers three deep over 48 elements, cold          |   328 us |  309 us | level                                                |
| The CSS of the tree of 500 from its HTML             |   137 us |  129 us | level                                                |

The repository's own file, `string-props.bench.ts`, renders a style element beside each class, as a classic server render does, so the engine is a smaller part of each render. Nine rounds:

| One render, with style elements       | Memo off | Memo on | What changed                     |
| ------------------------------------- | -------: | ------: | -------------------------------- |
| 48 elements, 2 variants by a prop     |   146 us |  113 us | 1.37 times faster, 22% less time |
| 48 elements, 48 combinations of props |   255 us |  205 us | 1.21 times faster, 20% less time |
| The tree of 500, rows chosen by props |  2.94 ms | 2.35 ms | 1.18 times faster, 20% less time |

With the memo off, 0.4.0 takes the path it took before the memo existed: the core before the memo and this one, with the option off, loaded side by side in one process, were level on every row (nine rounds).

## Against the styling library the design system used before

Every table of this section is from round 2, except the download size (round 1). The last column compares each UmberStyle column with Used before. [The style memo](style-memo.md) has a section that compares UmberStyle, with the memo off and on, with two other styling libraries by name.

### A class from a style object, no framework

One operation is one `css()` call of each side's own instance with no framework.

| One call                                      | Used before | UmberStyle, memo off | UmberStyle, memo on | Against Used before                                                                    |
| --------------------------------------------- | ----------: | -------------------: | ------------------: | -------------------------------------------------------------------------------------- |
| A condition, two values in turn, a new object |      281 ns |               475 ns |               84 ns | off 1.74 times slower; on 3.38 times faster                                            |
| The small style, one of four, a new object    |      735 ns |              1.06 us |              338 ns | off 1.42 times slower; on 2.15 times faster                                            |
| The large style, one of four, a new object    |     6.16 us |              9.68 us |             4.10 us | off 1.55 times slower; on 1.51 times faster                                            |
| A nested style, one of four, a new object     |      889 ns |              1.34 us |              421 ns | off 1.54 times slower; on 2.09 times faster                                            |
| A style that never repeats                    |     2.35 us |              1.35 us |             1.28 us | off 1.73 times faster; on 1.84 times faster                                            |
| A new small style                             |     3.89 us |              2.83 us |             2.79 us | off 1.40 times faster; on 1.38 times faster                                            |
| A new large style                             |     53.4 us |              23.1 us |             22.3 us | off 2.31 times faster; on 2.44 times faster                                            |
| The same small style again                    |      705 ns |               981 ns |              261 ns | off 1.66 times slower (the times: 1.39); on 2.35 times faster (the times: 2.70)        |
| The same large style again                    |     6.04 us |              9.26 us |             3.91 us | off 1.50 times slower; on 1.54 times faster                                            |
| A merge of two classes                        |      692 ns |               519 ns |              747 ns | off 1.56 times faster (the times: 1.33); on 1.49 times faster (the times: 1.08 slower) |
| A merge of five classes                       |     1.38 us |               694 ns |              687 ns | off 2.06 times faster; on 2.00 times faster                                            |

With the defaults, a new style and a merge are faster, and any style the cache has seen before is slower: Used before serializes a style to a text and hashes it, while UmberStyle merges it, compiles it to rules and hashes the rules. With the memo on, the calls of a style seen before are faster too. The two merge rows were noisy: read them as "faster, by an amount the rounds do not agree on".

### Components over a warm cache

One operation is one `renderToString` of 48 styled elements, markup only.

| 48 elements                       | Used before | UmberStyle, memo off | UmberStyle, memo on | Against Used before                                                             |
| --------------------------------- | ----------: | -------------------: | ------------------: | ------------------------------------------------------------------------------- |
| Fixed styles only                 |     82.9 us |              20.1 us |             20.3 us | off 4.13 times faster; on 4.16 times faster                                     |
| A function of the theme only      |     84.9 us |              20.6 us |             21.2 us | off 4.17 times faster; on 4.05 times faster                                     |
| 48 combinations of props          |      132 us |               111 us |             66.5 us | off 1.20 times faster; on 2.01 times faster                                     |
| 2 variants by a prop              |     76.8 us |              69.6 us |             40.2 us | off level (the times: 1.10 faster); on 1.71 times faster (the times: 1.91)      |
| A plain object in `style` on each |      167 us |              95.9 us |             57.1 us | off 1.60 times faster (the times: 1.74); on 2.73 times faster (the times: 2.93) |

A component whose class does not depend on props keeps its class for each theme, so rendering it again is a lookup. Used before serializes the styles of every element on every render, and renders one more element beside each. Prop-driven components are faster with the defaults and twice as fast with the memo.

### The first render over a fresh cache

One operation is one `renderToString` of 48 elements over a cache made for it, with the CSS of the page.

| 48 elements, cold                 | Used before | UmberStyle, memo off | UmberStyle, memo on | Against Used before                                                             |
| --------------------------------- | ----------: | -------------------: | ------------------: | ------------------------------------------------------------------------------- |
| Fixed styles only                 |     97.6 us |               161 us |              145 us | off 1.73 times slower; on 1.54 times slower                                     |
| A function of the theme only      |      123 us |               214 us |              354 us | off 2.06 times slower (the times: 1.74); on 1.73 times slower (the times: 2.87) |
| 48 combinations of props          |      176 us |               586 us |              467 us | off 2.83 times slower (the times: 3.34); on 2.65 times slower                   |
| A plain object in `style` on each |      172 us |               262 us |              216 us | off 1.50 times slower; on 1.23 times slower                                     |

Every first render is slower; see [Where it is slower, and why](#where-it-is-slower-and-why).

### A page of 500 elements

One operation is one `renderToString` of the tree of 500 styled elements.

| The tree of 500                             | Used before | UmberStyle, memo off | UmberStyle, memo on | Against Used before                         |
| ------------------------------------------- | ----------: | -------------------: | ------------------: | ------------------------------------------- |
| Warm, markup only                           |     1.92 ms |              1.66 ms |             1.16 ms | off 1.15 times faster; on 1.64 times faster |
| Warm, with its CSS                          |     1.90 ms |              1.58 ms |             1.20 ms | off 1.18 times faster; on 1.58 times faster |
| Cold, with its CSS                          |     1.59 ms |              2.28 ms |             1.94 ms | off 1.43 times slower; on 1.22 times slower |
| With no set-up: no cache, CSS in the markup |     2.30 ms |              2.70 ms |             2.24 ms | off 1.18 times slower; on level             |

### Nested themes

One operation is one `renderToString` of theme providers three deep over 48 elements that read the theme.

| Providers three deep | Used before | UmberStyle, memo off | UmberStyle, memo on | Against Used before                         |
| -------------------- | ----------: | -------------------: | ------------------: | ------------------------------------------- |
| Warm, markup only    |     89.7 us |              81.1 us |             78.7 us | off 1.12 times faster; on 1.15 times faster |
| Cold, with its CSS   |      101 us |               328 us |              309 us | off 3.23 times slower; on 3.06 times slower |

### The CSS of one page

One operation is the CSS of the tree of 500 read from its HTML, as one style tag, over a warm cache that holds more than the page.

| One page        | Used before | UmberStyle, memo off | UmberStyle, memo on | Against Used before                         |
| --------------- | ----------: | -------------------: | ------------------: | ------------------------------------------- |
| The tree of 500 |     45.8 us |               137 us |              129 us | off 2.95 times slower; on 2.80 times slower |

### Download size

This is the size of the library's own JavaScript that a browser downloads, not the CSS written for a page; the CSS a page gets is measured in [The CSS of one page](style-memo.md#the-css-of-one-page). This is not a speed. It is how much JavaScript the library adds to what a visitor's browser downloads before the page can run. Round 1. One small page (one theme, one provider, one styled button that reads a colour from the theme) was built for production once with each library, and once with no styling library; the size of that last one was taken away, so what is left is what the library adds. The first row below is the one a visitor pays for, since servers send JavaScript gzipped. The build: esbuild 0.25.12 (`--bundle --minify`, an ES module for a browser, `process.env.NODE_ENV` set to `production`).

| What the library adds to the download   | Used before | UmberStyle 0.4.0 | UmberStyle is    |
| --------------------------------------- | ----------: | ---------------: | ---------------- |
| As sent to the browser (gzipped)        |     10.7 KB |          32.4 KB | 3.0 times larger |
| After the browser unpacks it (minified) |     27.2 KB |          87.1 KB | 3.2 times larger |

Of the minified 87.1 KB, the core is 72.4 KB and the React binding 8.9 KB. The style memo, added in round 2, made the core 0.8 KB larger gzipped, on or off; the app was not bundled again after it.

### The score

Of the 27 timed rows above (the download size is not counted):

| UmberStyle 0.4.0 | Faster than Used before | Level | Slower |
| ---------------- | ----------------------: | ----: | -----: |
| Memo off         |                      12 |     1 |     14 |
| Memo on          |                      19 |     1 |      7 |

With the memo off, UmberStyle wins every warm render but one (2 variants by a prop, level), a new style, a style that never repeats and the merges, and loses every call of a style it has seen before, every first render, the page of 500 with no set-up, and the CSS of a page. With the memo on, the calls of a style seen before and the 2 variants move to its side, and the page with no set-up becomes level; the first renders and the CSS of a page stay slower. One win with the memo on, the merge of two classes, comes from rounds that do not agree: its times alone would make it 1.08 times slower. The bundle is larger in either case.

## A change of theme

The two sides are built differently, so this is not a like-for-like row and is kept out of the tables above. A style of UmberStyle reads tokens, which are CSS variables, so its classes are the same in every theme. A style of Used before reads values, so a component that reads the theme gets other classes in another theme, and the page must be rendered again.

- **In a browser,** a change of the theme of the outermost provider rewrites one rule, and no styled component renders again (see [Themes](themes.md) and [The root theme and switching](root-theme.md#switching-at-run-time)). This was not measured.
- **On a server,** both sides can render the page again in the other theme. UmberStyle can also send the other theme without a render: the class of the second theme, and the CSS of the page already rendered with that class.

Measured with UmberStyle 0.3.0 (the run before 0.4.0; it was not measured again), on the tree of 500, in two runs:

| One operation                                                | Used before | UmberStyle 0.3.0 | In words                                                               |
| ------------------------------------------------------------ | ----------: | ---------------: | ---------------------------------------------------------------------- |
| Render again in the other theme, with its CSS (run 1)        |     1.91 ms |          2.55 ms | 1.28 times slower                                                      |
| Render again in the other theme, with its CSS (run 2)        |     5.75 ms |          4.86 ms | 1.10 times slower by the rounds; 1.18 times faster by the times: noisy |
| No render: the CSS of the page with the second theme (run 1) |           - |           249 us | 0.13 of the time Used before takes to render again                     |
| No render: the CSS of the page with the second theme (run 2) |           - |           757 us | 0.11 of the time Used before takes to render again                     |

Rendering again is level to slower. Not rendering at all took 0.11 and 0.13 of the time Used before takes to render again.

## Where it is slower, and why

### The first render over a fresh cache

A fresh cache holds nothing, so UmberStyle compiles, names and writes every class and theme class the page uses, and the CSS of the page is built from them. Used before keeps what it compiled in a memo of the whole process, by the key of the cache, so its fresh cache is a small object over styles compiled by earlier requests. With that memo emptied for each cache, Used before took 2.34 ms for the cold tree of 500 in round 1, and UmberStyle 0.4.0 2.02 ms: 1.16 times faster than it. On the tree, that memo is the whole gap.

What would close it: sharing what one cache compiled with the next cache of the same options. The style memo does not do it: a memo belongs to one cache on purpose, so that a cache never names a class whose rule only another cache wrote. The style memo helps a first render only for styles that come three times or more in it (1.06 to 1.16 times faster). No issue of the repository plans more.

### The CSS of one page

UmberStyle collects the class names of the HTML, then builds the page's CSS in a fixed order: the layer order, the root theme trimmed to the variables the page uses, the theme classes and the classes sorted by name, each props class after its base class, and a stamp of the options. That order is what makes the CSS of a page the same whatever order the pages were rendered in. Used before runs one regular expression over the HTML and joins the CSS texts it stored when it wrote them, in the order it wrote them. 0.4.0 compares names in place, reads a repeated class once and sorts by keys made once (1.82 times faster than 0.3.0 in the comparison), and is still 2.95 times slower. No issue of the repository plans more.

### Download size

Almost all of the core is reachable through the object a style returns: `createStyle` returns `css`, `keyframes`, `globalStyles`, the sheets and the template parser, so a bundler keeps all of them even when an app uses none. The development checks are about 4 KB gzipped of the app, and stay, because `hasDevChecks: true` turns them on in any build, a production one too: leaving them out of a production bundle was measured at 4.3 KB smaller and not made, since it would change what that option does. What would close the rest is entries an app imports one by one instead of functions on one object; that would change the API, and no issue of the repository plans it.

### A style seen before, with the defaults

With the memo off, a style seen before in a new object is merged, compiled and hashed before its class is found: 1.4 to 1.7 times slower than Used before. The [style memo](style-memo.md) closes it, and is off by default until it has run in a real app.

## Memory

The bytes one operation allocates, as soroush-bench estimates them from the heap (round 2, the memo off; below about 1 KB the figure is noise):

| One operation                            | Used before | UmberStyle 0.4.0 |
| ---------------------------------------- | ----------: | ---------------: |
| A new small style                        |       805 B |            597 B |
| A new large style                        |      2.9 KB |           1.6 KB |
| 48 elements, fixed styles, warm          |    146.2 KB |          77.7 KB |
| 48 elements, 48 combinations, warm       |    199.3 KB |         273.8 KB |
| 48 elements, 48 combinations, cold       |    236.7 KB |         577.4 KB |
| The tree of 500, warm, markup only       |    550.5 KB |         763.9 KB |
| The CSS of the tree of 500 from its HTML |        43 B |         202.4 KB |

UmberStyle allocates less for a new style and for fixed components, and more for prop-driven and cold renders and for the CSS of a page, which Used before joins from texts it already holds. The same estimate moves a lot from run to run: round 1 gave 296.6 KB and 828.7 KB for the warm tree. With the memo on, the bytes of one call were within the tool's noise on every row; the memory usage of the memo is on [its page](style-memo.md#memory-usage), up to about 4 MB for each set of style options of a cache.

## Limits

- One desktop machine, in use during the runs (an editor, a browser, other containers). Docker Desktop does not pin its virtual machine to a performance core of the host, so the rounds are wide in places; four files of round 2 that ran while the machine was busy were run again on their own, and the rows marked noisy still have rounds that disagree. Compare the columns of one table, not figures from two runs: the 0.3.0 hit of the gate was 1.82 us in one run and 1.33 us in another.
- No browser: every figure is Node in a Docker sandbox, rendering to a string. No client render, hydration, `insertRule` into a real sheet or theme switch in a browser was measured. The DOM cases of [Benchmarks](benchmarks.md) run in jsdom, which is not a browser's DOM.
- The two sides do not send the same output. UmberStyle writes a base class and a props class, cascade layers and a stamp of its options; Used before writes one merged rule for each combination, with vendor prefixes, and its page with no set-up repeats the rules of the cells in every row. Each case returns the same kind of output on both sides (a class name, a markup string, or markup and the CSS of the page as one style tag), not the same characters.
- Not measured: development mode, the server components build, streaming, `Global` and `keyframes`, sheets and `useStyle`, Vue, the engine with labels or layers off; React Native has no counterpart on the other side. The change of theme was measured with 0.3.0 only, and the bundle was not measured again after the style memo.
- Used before ran without its build-time plugin.
