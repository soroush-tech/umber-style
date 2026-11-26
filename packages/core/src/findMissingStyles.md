# findMissingStyles.ts

## What it does

`findMissingStyles(root?, options?)` inspects a live page and returns a list of `StyleProblem`s: a class of
the engine on an element that no rule names (`class-without-rule`), a variable that a matching rule uses
and the element has no value for (`variable-without-value`), and a global rule for `html`, `body` or
`:root` whose variables nothing above declares (`root-without-theme`). An empty list means nothing is
missing.

## Why it exists

A styled page can look wrong with no error: a class that was never inserted, or a theme that is not
applied above the element that uses its variables. The browser says nothing. This check reads the rules of
the engine's own style elements from the document and compares them with the elements and their computed
style. It is run by the dev checker of a cache (`devChecks.ts`), by the end-to-end tests
(`e2e/helpers/rules.ts` and the dev tests), and exported by `index.ts` for anyone who wants it.

The first lines of the file say it imports nothing at run time: the end-to-end tests send its compiled text
into a page, so the checker they run is the one the development mode runs. For the same reason its name
readers (`isNameCode`, `readEscape`, `readName`) are a copy of `cssName.ts`, which the engine uses; they
are changed together.

## The logic

```mermaid
flowchart TD
  start["findMissingStyles(root, options)"] --> doc{"a document exists?"}
  doc -->|no| empty["return []"]
  doc -->|yes| prefix{"prefix from options or the first style element?"}
  prefix -->|none| empty
  prefix -->|found| rules["collectRules: style rules of the engine's style elements, groups included"]
  rules --> named["classes the rules name; markers: boundary, scheme-light, scheme-dark, theme-0"]
  named --> elements["root itself, then every element under it"]
  elements --> cls{"element has an engine class that is not a marker?"}
  cls -->|no| isRoot{"element is html or body?"}
  isRoot -->|yes| rootCheck["findRootProblems"]
  isRoot -->|no| nextEl["next element"]
  cls -->|yes| classCheck["findClassProblems: class not in the named set"]
  classCheck --> varCheck["findVariableProblems: matching rule, not a state, variable has no computed value"]
```

The rules are read from `style[data-style]`, `style[data-precedence]` (the ones React hoists) and
`style[data-umber]` elements of the prefix and of its `-global` set. For each rule the file keeps the
variables it uses without a fallback (`var(--prefix-x)`) and whether its selector is a state (`:hover`,
`:focus`, `:active`, `:focus-visible`, `:focus-within`). Rules for states are never checked.

### How a name is read

The classes that a rule names, and the variables that it uses, are read from the text of the rule
(`selectorText`, `cssText`), from the dot (or `var(`) to the first unit that a name of CSS cannot hold. A
class of the engine is `<prefix>-<label>-<hash><suffix>`, and the label carries the names of components as
they were given (`View`, `Sidebar-Item`), so upper-case letters are common; a label can hold any letter past
ASCII too. The engine writes the name as it is, never escaped, but a browser escapes a character in the
text of a rule that a name cannot hold as it is (`.a\:b`), and a rule written by hand can have escapes too.
So the reader takes every unit that a name can hold, and reads each escape to the character it stands for,
the form that `classList` holds.

```mermaid
flowchart TD
  at["the unit at end"] --> slash{"a backslash?"}
  slash -->|yes| hex{"hex digits after it?"}
  hex -->|"1 to 6"| code["their code point, and one white space after them; 0, half of a pair or past U+10FFFF is U+FFFD"]
  hex -->|none| next["the next unit as it is; past the end, nothing"]
  code --> add["add the character"]
  next --> add
  slash -->|no| name{"a letter of either case, a digit, -, _, or past ASCII?"}
  name -->|yes| add
  name -->|no| stop["the name ends"]
  add --> at
```

Each unit is tested with comparisons of its code, never with a regular expression.

## The data

```
{ kind: 'class-without-rule', name, element: 'div[card]', message, key: 'class:<name>' }
{ kind: 'variable-without-value', ..., key: 'variable:<name>:<selector>' }
{ kind: 'root-without-theme', ..., key: 'root:<selector>' }
```

`key` is what makes two problems the same one, so a warner can show each once.

## What it guarantees

- With no document or no engine style element, it returns `[]` (`findMissingStyles.node.test.ts`).
- A rule of another document (an iframe) is still read: a style rule is told by the name of its class, not
  by `instanceof`.
- A selector the browser cannot parse matches nothing and does not throw.
- A variable with a value from an ancestor is not a problem; only the computed value counts.
- A class with upper-case letters, letters past ASCII, or escapes in the text of its rule is read whole,
  so it is found when a rule names it and reported when none does (`findMissingStyles.test.ts`, and
  `page.browser.test.ts` for the escapes that Chromium keeps in `selectorText`; jsdom reads them itself).
- It reads, and never writes, the page.

## Decisions

- Marker classes (`-boundary`, `-scheme-light`, `-scheme-dark`) and `-theme-0`, the theme class of a theme
  that declares nothing, have no rule by design and are left out.
- A root problem is one for each rule, with all its missing variables, because the cause is one rule.
- `options.prefix` wins over the prefix read from the page.

## Limits

- It reads the stylesheet through `element.sheet`; a style element with no sheet is ignored.
- It cannot see a rule that the page never inserted for an element it does not hold in the DOM yet.
- A name is found by looking for `.<prefix>-` in the text of a selector: a prefix that the browser writes
  with an escape is not found, and a dot inside a string of an attribute selector is read as a class.
- A rule that uses one variable twice gives the problem twice; they have the same `key`, so a warner shows
  it once.
