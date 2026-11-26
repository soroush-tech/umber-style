# Performance

After this page you know how fast UmberStyle 0.8.0 is next to 0.7.0, its last release, and next to the styling library the design system used before, where it is slower and why, and what the [style memo](style-memo.md) changes. How to run the benchmarks, and what each of the repository's own files measures, is in [Benchmarks](benchmarks.md).

Times are written in `ns` (nanoseconds), `us` (microseconds) and `ms` (milliseconds). "Used before" in a table is the styling library the design system used before.

## In short

Measured on 0.8.0 (the method is in the next section):

- **A page rendered again over a warm cache is faster on five rows of eight**, level on one and slower on two. 48 styled elements rendered to a string are between 1.06 times slower (2 variants by a prop) and 3.97 times faster than Used before; the tree of 500 elements is level, 1.11 times slower with its CSS, and 1.60 times faster with the style memo on.
- **A component whose class does not depend on props is about 4 times faster** than Used before when it renders again: its class is looked up, not built.
- **Merging classes and making a new style are faster**: a merge of two classes 1.64 times, of five 2.24 times; a new small style 1.41 times, a new large one 2.47 times.
- **A change of theme renders nothing.** Sending a page in another theme from a server took 0.11 to 0.13 of the time Used before takes to render it again (measured with 0.3.0).
- **The first render over a fresh cache is slower**: 1.6 to 3.0 times on 48 elements, 3.3 times with nested providers, 1.13 times on the tree of 500 (level with the memo on).
- **The CSS of one page, read from its HTML, is 2.87 times slower.**
- **It is a larger download**: it adds 37.5 KB, gzipped, to the JavaScript a visitor downloads for a small app, against 10.7 KB: 3.5 times as much.
- **A style seen before, in a new object, is 1.5 to 1.7 times slower** with the defaults. With the style memo on, the same calls are 1.6 to 3.2 times faster than Used before.
- **Against 0.7.0, 0.8.0 is level**: six of the seven files of the gate are within 5%, and the seventh, 1.07 times slower, runs code that did not change and is as far apart on identical code. In the comparison run it was level on 22 of 27 rows, and 1.05 to 1.10 times slower on five.
- **On a design system's pages**, rendered as that design system renders them (value repair on), the median render of UmberStyle 0.8.0 is 1.13 times slower than Used before with the defaults and level with the style memo on, on the page of every component; on its home page, 1.31 and 1.12 times slower.

## What was measured, and how

- **The sides.** UmberStyle 0.7.0 (`@umber-style/core`, `react`, `css` and `cache`) and Used before (its React, styled, plain-class, cache and server packages, at the versions of the run of 0.4.0, which are still their latest releases) were installed from npm. UmberStyle 0.8.0 was packed from this tree with `pnpm pack` after `pnpm build`, as `pnpm smoke:packed` packs it, and installed beside them. React and `react-dom` 19.3.1, one copy for every side. 0.8.0 ran twice, with the defaults (the memo off) and with `hasStyleMemo: true`, each under a prefix of its own so that the two shared nothing; 0.7.0 ran with the defaults.
- **Production on every side.** Each file checks it before it measures, and throws otherwise: `NODE_ENV` is `production`, `isDevelopment()` of each core is `false`, React's production builds are loaded, no `.development.` module is, and the versions are the ones named.
- **The sandbox.** soroush-bench 2.2.3 in Docker, Node 24.22.3 in its sandbox, pinned to one CPU with 512 MB (`--cpus 1 --cpuset 0 --memory 512m`), five rounds of each file. Each file is one scenario with all its sides, so the sides are measured in the same round of the same process.
- **The figures.** A time is the median of the five rounds of the mean time of one operation. "Times faster" and "times slower" are the median of the ratios of the five rounds, which is not always the ratio of the two times shown; where the two differ by more than 0.15, or point opposite ways, the row says so. "Level" is within 5%.
- **The same work on each side.** The inputs are the repository's own benchmark inputs (`bench/src/`): the same style objects, the same small theme, the same 48 prop combinations, the same tree of 500 (100 rows chosen by props, of four cells that read the theme), a label on every component. Each side is used as its own documentation says. "Warm" means a cache made warm by a render before the measurement; "cold" means a fresh cache for every render. The server cache of Used before keeps what it compiled in a memo of the whole process, by the key of the cache, so a fresh cache of it compiles nothing that an earlier cache of the same key compiled. That is its real behaviour on a server, and it is in every cold row.
- **Rendering to a string in Node.** Nothing ran in a browser.
- **One run, one row again.** The 27 files ran one after the other on 2026-11-26. One file (48 elements with a plain object in `style`, cold) had rounds more than half apart, and was run again with all its sides; the second run is shown.
- **A real app.** The two pages of the design system are measured apart, on the host, with that design system's own options; [Two pages of a design system](#two-pages-of-a-design-system) says how.

## Against 0.7.0

The gate of the repository builds 0.7.0 from its git tag and runs it beside this version, in one sandbox, five rounds (the memo off). It fails a case slower than 1.25 times 0.7.0; every case passed.

| One operation                                                      |   0.7.0 |   0.8.0 | 0.8.0 is          |
| ------------------------------------------------------------------ | ------: | ------: | ----------------- |
| `cache.css(style)` of the same small style again                   |  975 ns | 1.01 us | level             |
| `cache.css(a, b, c, d, e)` of five classes it made                 |  291 ns |  284 ns | level             |
| `cache.css(style)` of a small style it has not seen                | 3.27 us | 3.35 us | level             |
| `cache.css(style)` of a large style it has not seen                | 23.6 us | 24.0 us | level             |
| The CSS of one page of ten, 300 elements                           |  127 us |  125 us | level             |
| A theme class of the large theme the engine has not seen           |  257 us |  254 us | level             |
| `createTokens` and `declare` of the large theme (about 280 tokens) |  570 us |  611 us | 1.07 times slower |

The gate is one run of the seven files, on 2026-11-26; "level" here is the median of the ratios of the five rounds within 5%, as everywhere on this page. The one row outside it, the tokens of a theme, runs code that did not change between the two releases, and on identical code (`--ref HEAD`) the same file came out 11.6% slower in one run and level in another: it is the noise of the gate. So are the slower extraction (10.6% to 12.8%) and the 18% more memory for a new large style that earlier runs of the gate showed: run again against 0.7.0 and against a second build of 0.8.0 itself, they came out no slower, and allocating no more, against 0.7.0 than against 0.8.0 itself, and on the host the two builds allocate the same bytes for a new large style. [How it was checked](benchmarks.md#how-it-was-checked) has the figures.

In the comparison run, where 0.7.0 and 0.8.0 also render components, 0.8.0 with the defaults was level with 0.7.0 on 22 of the 27 rows. It was slower on five: the merge of two classes 1.10 times, the warm tree of 500 1.08 times and 1.09 times with its CSS, the tree with no set-up 1.09 times, and 48 themed elements cold 1.05 times. With the memo off these rows run what 0.7.0 runs but for two changes (the core empties its memos when the values of the tokens change, and the React provider copies a theme that crosses from a server component, #81), neither of them on the path of a warm render; the gate on identical code differed by up to 11.6% in the runs of 0.8.0 ([Benchmarks](benchmarks.md#how-it-was-checked)), so these five are within what the method can tell apart; they were not looked at further.

## With the style memo off and on

The memo is off by default. What it is, how to turn it on, and its risks are on [its own page](style-memo.md). The comparison run of 0.8.0, UmberStyle alone.

The call of the owner's case, and others like it: one operation is one `css()` call of a style in a new object.

| One operation                                                           | Memo off | Memo on | What changed                        |
| ----------------------------------------------------------------------- | -------: | ------: | ----------------------------------- |
| A condition, `{ fontSize: isMobile ? 12 : 48 }`, the two values in turn |   498 ns |   86 ns | 5.56 times faster (the times: 5.79) |
| The small style, one of four in turn                                    |  1.13 us |  343 ns | 3.24 times faster                   |
| The large style, one of four in turn                                    |  9.67 us | 4.16 us | 2.34 times faster                   |
| A nested style, one of four in turn                                     |  1.42 us |  404 ns | 3.49 times faster                   |
| The same small style again                                              |  1.03 us |  282 ns | 3.68 times faster                   |
| The same large style again                                              |  9.50 us | 3.88 us | 2.46 times faster                   |
| A style that never repeats, `{ left: n }`                               |  1.45 us | 1.39 us | level                               |
| A new small style (first sight)                                         |  2.91 us | 2.93 us | level                               |
| A new large style (first sight)                                         |  22.3 us | 21.8 us | level                               |
| A merge of two classes                                                  |   437 ns |  452 ns | level                               |
| A merge of five classes                                                 |   678 ns |  667 ns | level                               |

Components rendered to a string. One operation is one `renderToString` of the whole set: 48 elements, or the tree of 500.

| One render                                           | Memo off | Memo on | What changed                        |
| ---------------------------------------------------- | -------: | ------: | ----------------------------------- |
| 48 elements, 2 variants by a prop, warm              |  76.0 us | 39.9 us | 1.90 times faster, 48% less time    |
| 48 elements, 48 combinations of props, warm          |   121 us | 64.0 us | 1.84 times faster, 47% less time    |
| 48 elements, a plain object in `style` on each, warm |  85.5 us | 49.7 us | 1.77 times faster, 42% less time    |
| 48 elements, fixed styles, warm                      |  20.9 us | 20.9 us | level                               |
| 48 elements, a function of the theme, warm           |  23.0 us | 22.1 us | level                               |
| The tree of 500, warm, markup only                   |  1.65 ms | 1.03 ms | 1.58 times faster, 38% less time    |
| The tree of 500, warm, with its CSS                  |  1.77 ms | 1.11 ms | 1.54 times faster, 37% less time    |
| Providers three deep over 48 elements, warm          |  25.6 us | 24.4 us | 1.05 times faster                   |
| 48 elements, fixed styles, cold                      |   159 us |  161 us | level                               |
| 48 elements, a function of the theme, cold           |   202 us |  186 us | 1.12 times faster                   |
| 48 elements, 48 combinations, cold                   |   521 us |  493 us | 1.07 times faster                   |
| 48 elements, a plain object in `style`, cold         |   267 us |  231 us | 1.33 times faster (the times: 1.16) |
| The tree of 500, cold, with its CSS                  |  2.17 ms | 1.86 ms | 1.19 times faster                   |
| The tree of 500, with no set-up (the default style)  |  2.04 ms | 1.56 ms | 1.36 times faster                   |
| Providers three deep over 48 elements, cold          |   323 us |  306 us | level (the times: 1.06 faster)      |
| The CSS of the tree of 500 from its HTML             |   133 us |  133 us | level                               |

The repository's own file, `string-props.bench.ts`, renders a style element beside each class, as a classic server render does, so the engine is a smaller part of each render. Nine rounds, on 0.8.0, with the soroush-bench of the workspace (2.4.0, Node 24.22.3 in its sandbox):

| One render, with style elements       | Memo off | Memo on | What changed                     |
| ------------------------------------- | -------: | ------: | -------------------------------- |
| 48 elements, 2 variants by a prop     |  98.9 us | 63.2 us | 1.54 times faster, 36% less time |
| 48 elements, 48 combinations of props |   168 us |  113 us | 1.47 times faster, 33% less time |
| The tree of 500, rows chosen by props |  1.95 ms | 1.46 ms | 1.32 times faster, 25% less time |

In the comparison run, 0.8.0 with the memo off and 0.7.0 were level on the rows of this section but the five named in [Against 0.7.0](#against-070).

## Against the styling library the design system used before

Every table of this section is from the comparison run of 0.8.0, except the download size and the design system's pages, which say how they were measured. The last column compares each UmberStyle column with Used before. [The style memo](style-memo.md) has a section that compares UmberStyle, with the memo off and on, with two other styling libraries by name.

### A class from a style object, no framework

One operation is one `css()` call of each side's own instance with no framework.

| One call                                      | Used before | UmberStyle, memo off | UmberStyle, memo on | Against Used before                         |
| --------------------------------------------- | ----------: | -------------------: | ------------------: | ------------------------------------------- |
| A condition, two values in turn, a new object |      286 ns |               498 ns |               86 ns | off 1.72 times slower; on 3.22 times faster |
| The small style, one of four, a new object    |      769 ns |              1.13 us |              343 ns | off 1.47 times slower; on 2.26 times faster |
| The large style, one of four, a new object    |     6.49 us |              9.67 us |             4.16 us | off 1.48 times slower; on 1.58 times faster |
| A nested style, one of four, a new object     |      897 ns |              1.42 us |              404 ns | off 1.56 times slower; on 2.25 times faster |
| A style that never repeats                    |     2.56 us |              1.45 us |             1.39 us | off 1.68 times faster; on 1.86 times faster |
| A new small style                             |     4.13 us |              2.91 us |             2.93 us | off 1.41 times faster; on 1.42 times faster |
| A new large style                             |     55.1 us |              22.3 us |             21.8 us | off 2.47 times faster; on 2.48 times faster |
| The same small style again                    |      603 ns |              1.03 us |              282 ns | off 1.70 times slower; on 2.14 times faster |
| The same large style again                    |     6.25 us |              9.50 us |             3.88 us | off 1.56 times slower; on 1.62 times faster |
| A merge of two classes                        |      712 ns |               437 ns |              452 ns | off 1.64 times faster; on 1.58 times faster |
| A merge of five classes                       |     1.52 us |               678 ns |              667 ns | off 2.24 times faster; on 2.24 times faster |

With the defaults, a new style and a merge are faster, and any style the cache has seen before is slower: Used before serializes a style to a text and hashes it, while UmberStyle merges it, compiles it to rules and hashes the rules. With the memo on, the calls of a style seen before are faster too.

### Components over a warm cache

One operation is one `renderToString` of 48 styled elements, markup only.

| 48 elements                       | Used before | UmberStyle, memo off | UmberStyle, memo on | Against Used before                         |
| --------------------------------- | ----------: | -------------------: | ------------------: | ------------------------------------------- |
| Fixed styles only                 |     83.9 us |              20.9 us |             20.9 us | off 3.97 times faster; on 4.02 times faster |
| A function of the theme only      |     84.2 us |              23.0 us |             22.1 us | off 3.77 times faster; on 3.86 times faster |
| 48 combinations of props          |      135 us |               121 us |             64.0 us | off 1.14 times faster; on 2.08 times faster |
| 2 variants by a prop              |     71.4 us |              76.0 us |             39.9 us | off 1.06 times slower; on 1.79 times faster |
| A plain object in `style` on each |      152 us |              85.5 us |             49.7 us | off 1.79 times faster; on 3.18 times faster |

A component whose class does not depend on props keeps its class for each theme, so rendering it again is a lookup. Used before serializes the styles of every element on every render, and renders one more element beside each. Prop-driven components are between 1.06 times slower and 1.79 times faster with the defaults, and two to three times faster with the memo.

### The first render over a fresh cache

One operation is one `renderToString` of 48 elements over a cache made for it, with the CSS of the page.

| 48 elements, cold                 | Used before | UmberStyle, memo off | UmberStyle, memo on | Against Used before                         |
| --------------------------------- | ----------: | -------------------: | ------------------: | ------------------------------------------- |
| Fixed styles only                 |     93.9 us |               159 us |              161 us | off 1.69 times slower; on 1.74 times slower |
| A function of the theme only      |      101 us |               202 us |              186 us | off 2.07 times slower; on 1.85 times slower |
| 48 combinations of props          |      176 us |               521 us |              493 us | off 3.01 times slower; on 2.80 times slower |
| A plain object in `style` on each |      171 us |               267 us |              231 us | off 1.64 times slower; on 1.35 times slower |

Every first render is slower; see [Where it is slower, and why](#where-it-is-slower-and-why).

### A page of 500 elements

One operation is one `renderToString` of the tree of 500 styled elements.

| The tree of 500                             | Used before | UmberStyle, memo off | UmberStyle, memo on | Against Used before                         |
| ------------------------------------------- | ----------: | -------------------: | ------------------: | ------------------------------------------- |
| Warm, markup only                           |     1.65 ms |              1.65 ms |             1.03 ms | off level; on 1.60 times faster             |
| Warm, with its CSS                          |     1.53 ms |              1.77 ms |             1.11 ms | off 1.11 times slower; on 1.38 times faster |
| Cold, with its CSS                          |     1.92 ms |              2.17 ms |             1.86 ms | off 1.13 times slower; on level             |
| With no set-up: no cache, CSS in the markup |     2.91 ms |              2.04 ms |             1.56 ms | off 1.39 times faster; on 1.86 times faster |

Used before took less time for the warm tree with its CSS than for the markup alone; the two rows are two files, two processes, and a difference of that size between them is the noise of the run.

### Nested themes

One operation is one `renderToString` of theme providers three deep over 48 elements that read the theme.

| Providers three deep | Used before | UmberStyle, memo off | UmberStyle, memo on | Against Used before                         |
| -------------------- | ----------: | -------------------: | ------------------: | ------------------------------------------- |
| Warm, markup only    |     82.0 us |              25.6 us |             24.4 us | off 3.19 times faster; on 3.42 times faster |
| Cold, with its CSS   |      100 us |               323 us |              306 us | off 3.29 times slower; on 3.05 times slower |

### The CSS of one page

One operation is the CSS of the tree of 500 read from its HTML, as one style tag, over a warm cache that holds more than the page.

| One page        | Used before | UmberStyle, memo off | UmberStyle, memo on | Against Used before                         |
| --------------- | ----------: | -------------------: | ------------------: | ------------------------------------------- |
| The tree of 500 |     46.2 us |               133 us |              133 us | off 2.87 times slower; on 2.86 times slower |

### Two pages of a design system

Two pages of the design system that moved from Used before to UmberStyle were bundled for a server once with each engine, from its own components and with its own options: `every-component`, every example of its catalog that renders alone (82 components), and `home-page`, the examples of three components. On UmberStyle it calls `configure({ prefix: 'soroush', hasValueRepair: true, rawKeys: [...] })` and leaves the rest to the defaults, so each styled element renders its style element into the HTML; on Used before the page is wrapped in its cache provider and its CSS extracted from the HTML apart. One operation is the whole server path of each: a warm `renderToString` of the page in its theme provider with its global styles, then the extraction (on UmberStyle the extraction finds nothing, as the HTML holds the styles already). The memo-on column adds `hasStyleMemo: true` to that `configure` call and changes nothing else; the HTML and the CSS of each page are byte for byte the same with it on and off, and with 0.7.0.

Measured on 0.8.0, on the host and not in the sandbox: Node 26.4.0, `NODE_ENV=production`, `--expose-gc` with a young generation fixed at 128 MB; each page and side in a Node process of its own, seven rounds with the sides in turn and the order reversed from one round to the next, and in each process 300 timed renders after 100. "Fastest" is the shortest render of all rounds, "median" the median of the medians of the rounds, and "allocated" the median growth of the heap over 30 batches of five renders, each batch after a forced collection (1 KB is 1024 bytes here). "Against Used before" is the ratio of the two figures shown.

| One page, warm             | Used before | UmberStyle, memo off | UmberStyle, memo on | Against Used before                         |
| -------------------------- | ----------: | -------------------: | ------------------: | ------------------------------------------- |
| Every component, fastest   |     3.53 ms |              3.98 ms |             3.39 ms | off 1.13 times slower; on level             |
| Every component, median    |     3.89 ms |              4.38 ms |             3.85 ms | off 1.13 times slower; on level             |
| Every component, allocated |      3.4 MB |               4.7 MB |              3.6 MB | off 1.38 times more; on 1.06 times more     |
| Home page, fastest         |       55 us |                65 us |               53 us | off 1.18 times slower; on level             |
| Home page, median          |       67 us |                88 us |               75 us | off 1.31 times slower; on 1.12 times slower |
| Home page, allocated       |       78 KB |               119 KB |              105 KB | off 1.53 times more; on 1.35 times more     |

With the memo on, the page of every component takes 12% less time by the median than with it off and allocates 23% less. 0.7.0, measured in the same rounds with the defaults, took 3.98 ms and 4.40 ms on that page and 64 us and 89 us on the home page: level with 0.8.0 with the memo off. The design system itself runs with the memo off.

### Download size

This is the size of the library's own JavaScript that a browser downloads, not the CSS written for a page; the CSS a page gets is measured in [The CSS of one page](style-memo.md#the-css-of-one-page). This is not a speed. It is how much JavaScript the library adds to what a visitor's browser downloads before the page can run. Measured on 0.8.0: one small page (one theme, one provider, one styled button that reads a colour from the theme) was built for production once with each library, and once with no styling library; the size of that last one was taken away, so what is left is what the library adds. The first row below is the one a visitor pays for, since servers send JavaScript gzipped. The build: esbuild 0.25.12 (`--bundle --minify`, an ES module for a browser, `process.env.NODE_ENV` set to `production`), each side a clean install of its packages and React 19.3.1.

| What the library adds to the download   | Used before | UmberStyle 0.8.0 | UmberStyle is    |
| --------------------------------------- | ----------: | ---------------: | ---------------- |
| As sent to the browser (gzipped)        |     10.7 KB |          37.5 KB | 3.5 times larger |
| After the browser unpacks it (minified) |     27.2 KB |           102 KB | 3.8 times larger |

Of the minified 102 KB, the core is 81.9 KB, the React binding 14.1 KB and the prop filter of `@umber-style/is-prop-valid` 4.4 KB. In 0.4.0 the same app was 32.4 KB gzipped and 87.1 KB minified with UmberStyle, of which the core was 72.4 KB and the React binding 8.9 KB; the sizes of Used before are the same as then.

### The score

Of the 27 timed rows of the comparison run above (the design system's pages and the download size are not counted):

| UmberStyle 0.8.0 | Faster than Used before | Level | Slower |
| ---------------- | ----------------------: | ----: | -----: |
| Memo off         |                      11 |     1 |     15 |
| Memo on          |                      20 |     1 |      6 |

With the memo off, UmberStyle wins every warm render of 48 elements but one (2 variants by a prop, 1.06 times slower), the page of 500 with no set-up, the warm nested providers, a new style, a style that never repeats and the merges. It is level on the warm tree, and loses every call of a style it has seen before, the warm tree with its CSS, every first render and the CSS of a page. With the memo on, the calls of a style seen before, the 2 variants and the warm tree with its CSS move to its side, and the cold tree becomes level; the five other first renders and the CSS of a page stay slower. The bundle is larger in either case.

## A change of theme

The two sides are built differently, so this is not a like-for-like row and is kept out of the tables above. A style of UmberStyle reads tokens, which are CSS variables, so its classes are the same in every theme. A style of Used before reads values, so a component that reads the theme gets other classes in another theme, and the page must be rendered again.

- **In a browser,** a change of the theme of the outermost provider rewrites one rule, and no styled component renders again (see [Themes](themes.md) and [The root theme and switching](root-theme.md#switching-at-run-time)). This was not measured.
- **On a server,** both sides can render the page again in the other theme. UmberStyle can also send the other theme without a render: the class of the second theme, and the CSS of the page already rendered with that class.

Measured with UmberStyle 0.3.0 (it was not measured again on a later version), on the tree of 500, in two runs:

| One operation                                                | Used before | UmberStyle 0.3.0 | In words                                                               |
| ------------------------------------------------------------ | ----------: | ---------------: | ---------------------------------------------------------------------- |
| Render again in the other theme, with its CSS (run 1)        |     1.91 ms |          2.55 ms | 1.28 times slower                                                      |
| Render again in the other theme, with its CSS (run 2)        |     5.75 ms |          4.86 ms | 1.10 times slower by the rounds; 1.18 times faster by the times: noisy |
| No render: the CSS of the page with the second theme (run 1) |           - |           249 us | 0.13 of the time Used before takes to render again                     |
| No render: the CSS of the page with the second theme (run 2) |           - |           757 us | 0.11 of the time Used before takes to render again                     |

Rendering again is level to slower. Not rendering at all took 0.11 and 0.13 of the time Used before takes to render again.

## Where it is slower, and why

### The first render over a fresh cache

A fresh cache holds nothing, so UmberStyle compiles, names and writes every class and theme class the page uses, and the CSS of the page is built from them. Used before keeps what it compiled in a memo of the whole process, by the key of the cache, so its fresh cache is a small object over styles compiled by earlier requests. With that memo emptied for each cache, Used before took 2.46 ms for the cold tree of 500 in the run of 0.8.0, and UmberStyle 0.8.0 2.17 ms: 1.12 times faster than it. On the tree, that memo is the whole gap.

What would close it: sharing what one cache compiled with the next cache of the same options. The style memo does not do it: a memo belongs to one cache on purpose, so that a cache never names a class whose rule only another cache wrote. The style memo helps a first render only for styles that come three times or more in it (level to 1.33 times faster on the cold rows above). No issue of the repository plans more.

### The CSS of one page

UmberStyle collects the class names of the HTML, then builds the page's CSS in a fixed order: the layer order, the root theme trimmed to the variables the page uses, the theme classes and the classes sorted by name, each props class after its base class, and a stamp of the options. That order is what makes the CSS of a page the same whatever order the pages were rendered in. Used before runs one regular expression over the HTML and joins the CSS texts it stored when it wrote them, in the order it wrote them. 0.4.0 made the scan compare names in place, read a repeated class once and sort by keys made once (1.82 times faster than 0.3.0 then); 0.8.0 is still 2.87 times slower than Used before. No issue of the repository plans more.

### Download size

Almost all of the core is reachable through the object a style returns: `createStyle` returns `css`, `keyframes`, `globalStyles`, the sheets and the template parser, so a bundler keeps all of them even when an app uses none. The development checks are about 4 KB gzipped of the app, and stay, because `hasDevChecks: true` turns them on in any build, a production one too: leaving them out of a production bundle was measured at 4.3 KB smaller (on 0.4.0) and not made, since it would change what that option does. What would close the rest is entries an app imports one by one instead of functions on one object; that would change the API, and no issue of the repository plans it.

### A style seen before, with the defaults

With the memo off, a style seen before in a new object is merged, compiled and hashed before its class is found: 1.5 to 1.7 times slower than Used before. The [style memo](style-memo.md) closes it, and is off by default.

## Memory

The bytes one operation allocates, as soroush-bench estimates them from the heap (the comparison run of 0.8.0, the memo off; below about 1 KB the figure is noise):

| One operation                            | Used before | UmberStyle 0.8.0 |
| ---------------------------------------- | ----------: | ---------------: |
| A new small style                        |       804 B |            590 B |
| A new large style                        |      1.8 KB |           1.6 KB |
| 48 elements, fixed styles, warm          |    146.1 KB |          78.0 KB |
| 48 elements, 48 combinations, warm       |    199.4 KB |         254.0 KB |
| 48 elements, 48 combinations, cold       |    236.6 KB |         531.0 KB |
| The tree of 500, warm, markup only       |    294.7 KB |         777.7 KB |
| The CSS of the tree of 500 from its HTML |        25 B |         202.8 KB |

UmberStyle allocates less for a new style and for fixed components, and more for prop-driven and cold renders and for the CSS of a page, which Used before joins from texts it already holds. The same estimate moves a lot from run to run: the run for [the style memo's page](style-memo.md#a-page-of-500-elements-and-nested-themes) gave 547.2 KB and 649.2 KB for the warm tree. With the memo on, the estimate went from tens of bytes to more than with it off, row to row and run to run, so it is not shown; the memory usage of the memo is on [its page](style-memo.md#memory-usage), up to about 4 MB for each set of style options of a cache.

## Limits

- One desktop machine, in use during the runs (an editor, a browser, other containers, among them a development server). Docker Desktop does not pin its virtual machine to a performance core of the host, so the rounds are wide in places; the one file whose rounds were more than half apart was run again, and the rows marked with "the times" have rounds that disagree with the medians. Compare the columns of one table, not figures from two runs: the warm tree of Used before was 1.65 ms in this run and 1.96 ms in the run of the style memo's page.
- No browser: every figure is Node, rendering to a string, in a Docker sandbox for the comparison run and on the host for the design system's pages. No client render, hydration, `insertRule` into a real sheet or theme switch in a browser was measured. The DOM cases of [Benchmarks](benchmarks.md) run in jsdom, which is not a browser's DOM.
- The two sides do not send the same output. UmberStyle writes a base class and a props class, cascade layers and a stamp of its options; Used before writes one merged rule for each combination, with vendor prefixes, and its page with no set-up repeats the rules of the cells in every row. Each case returns the same kind of output on both sides (a class name, a markup string, or markup and the CSS of the page as one style tag), not the same characters.
- Not measured: development mode, the server components build, streaming, `Global` and `keyframes` apart from the design system's pages, sheets and `useStyle`, Vue, the engine with labels or layers off; React Native has no counterpart on the other side. The change of theme was measured with 0.3.0 only.
- The design system's pages are one design system, one version of it, bundled once; another app renders other styles in other proportions.
- Used before ran without its build-time plugin.
