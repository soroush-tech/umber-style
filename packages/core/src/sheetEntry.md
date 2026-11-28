# sheetEntry.ts

## What it does

Makes and reads sheet entries, the objects a sheet holds for each name. `createSheetEntry(className,
source?)` returns a frozen object that prints as its class name. `isSheetEntry` knows one,
`readEntrySource` gives what a cache made it with, `findEntryCache` finds the cache of the first entry in a
list, `readEntryStyle` gives the style of an entry, and `flattenStyle` turns a `style` prop into a flat
list of entries and plain style objects; handles of a sheet made from a function of the theme are resolved
there.

## Why it exists

A sheet entry has to work in three places at once: as a class name on a plain element, as a value in the
`style` prop of a styled component, and as a style to merge into another class. A framework may copy,
spread or merge it on the way (Vue merges the objects of an array). The entry therefore has a branded
shape, one enumerable key that survives a merge, and a hidden source that a cache fills in so that the
rule is written when the entry is used, not when it is made. `flattenStyle` reads a `style` prop back into
entries after such a merge. Importers: `cache.ts`, `createEngine.ts`, `css.ts`, `globalStyles.ts`,
`templateStyle.ts`, `styleTypes.ts`, `types.ts`, and the bindings (`createStyle.ts`, `styledParts.ts`,
`styled.ts`).

## The logic

```mermaid
flowchart TD
  mk["createSheetEntry(className, source?)"] --> obj["object with key --umber-entry-NAME = null and a brand symbol"]
  obj --> props["className and toString read through source.use('components') or the name"]
  props --> src{"source given?"}
  src -->|yes| extra["add source symbol, name, and a lazy styles getter"]
  src -->|no| frozen
  extra --> frozen["Object.freeze"]
  flat["flattenStyle(style, findEntry, cache?)"] --> visit{"value is"}
  visit -->|array| rec["visit each item"]
  visit -->|"non-empty string"| err["throw: a string cannot be merged"]
  visit -->|"a handle"| handle{"cache given (a styled component)?"}
  handle -->|yes| readH["push source.read(): the binding's useStyle(sheet)[key]"]
  handle -->|no| typeErr["TypeError of css()"]
  visit -->|"entry with a source"| keep["push the entry"]
  visit -->|"other object"| split["split keys"]
  split --> k{"key"}
  k -->|"--umber-entry-NAME"| left1{"cache, no findEntry, no brand, and the only key?"}
  left1 -->|yes| warn1["warnLeftover: once a key, in development"] --> look
  left1 -->|no| look["findEntry(NAME) or a name-only entry"]
  k -->|"--umber-themed-ID"| merges{"findEntry given (Vue)?"}
  merges -->|yes| merged["the handle of ID: same as a handle above"]
  merges -->|no| left2{"cache, and the only key?"}
  left2 -->|yes| warn2["warnLeftover; nothing pushed"]
  left2 -->|no| dropped["nothing pushed"]
  k -->|other| rest["collect into one plain object"]
  rest --> pushR["push the object if it has keys"]
  visit -->|"anything else"| drop["dropped"]
```

Reading `className` or the string form calls `source.use('components')`, which writes the rule the first
time. `styles` is read once and kept. An entry without a source is only a name.

## The data

A sheet entry is the object `{ '--umber-entry-<className>': null, [BRAND]: true }` with non-enumerable
`className`, `toString`, and, with a source, `[SOURCE]`, `name` and `styles`. `EntrySource` has `style`,
`cache`, `use(role)` and `readStyles()`; a role is `components` (on its own) or `overrides` (given to a
styled component). The test shows that two entries spread together keep two keys,
`['--umber-entry-a', '--umber-entry-b']`, and `flattenStyle` gives back `['a', 'b']`.

A leftover is what a style becomes when a server component passes it to a client component: React
serializes the props of a client component, so an entry arrives as `{ '--umber-entry-<class>': null }` and
a handle as `{ '--umber-themed-<id>': null }`, plain objects with no brand and no CSS.

## What it guarantees

- An entry is frozen, and its only enumerable value is `null`, so a plain element renders no `style`
  attribute (the test `holds nothing a plain element would write`).
- A rule is written on first use of the class name, never when the entry is made.
- A merge of style objects keeps every entry, because each has its own key.
- `flattenStyle` keeps order: entries and plain keys come out in the order met, with the plain keys of one
  object collected together after its entries.
- A handle is resolved only with `cache` (the `style` of a styled component, which has a theme); without
  it, and in `readEntryStyle` (`globalStyles()`, `Global`, `css()` merges), it is a `TypeError` naming the
  place.
- With `cache` and no `findEntry` (the React builds), a leftover warns once for each key, in development:
  `[<prefix>] A style was passed from a server component to a client component (<key>), and its CSS cannot cross: import the sheet in the client component, and pass a plain value such as a string to choose the style.`
  The entry leftover is still its class name, with no rule (the check of the page also warns that no rule
  names it); a handle leftover gives nothing.
- `readEntryStyle` throws a `TypeError` that names the caller for an entry that is only a name.

## Decisions

- The brand and the source are `Symbol.for` symbols, so two copies of the packages recognise each other's
  entries.
- A spread copies the brand but not the source (the source is non-enumerable), so an entry with a source is
  taken to be whole, and a spread copy falls back to its key (comment inside `flattenStyle`).
- A style given as a string is an error: a text style cannot be merged into a class.
- The CSS of a style does not cross from a server component to a client component (decision 3 of #88 was
  withdrawn): a client component imports the sheet and is given a plain value that chooses the style. The
  leftover is told apart by its shape only: one key, no brand, in a binding that does not merge style
  objects, where nothing else makes such an object.
- Only a binding that merges style objects (Vue, which gives `findEntry`) looks up the key of a handle: in
  React such a key can only be a leftover, and its id, a counter of another program, could name another
  handle of this one.
- The reason for the key prefix `--umber-entry-` over another form is not recorded; the comment ties it to
  Vue's merging of style objects and to both frameworks skipping a `null` value on a plain element.

## Limits

- An entry that is only a name has no style: `readEntryStyle` throws, and a template merge throws the
  same (`templateStyle.ts`).
- `findEntry` is optional; without it an entry found by key is a bare name entry.
- A leftover in a list with other keys of its object, or in Vue, is not warned about; nor is a class name
  passed as a string (the check of the page names it).
