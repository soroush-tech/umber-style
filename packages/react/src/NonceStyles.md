# NonceStyles.tsx

Build: client (`'use client'`). The server build reaches it by reference, from `inlineStyles.server.ts`;
`ProviderScope.tsx` renders it too.

## What it does

`NonceStyles` holds the style texts of one component of the server build in a request that had a nonce,
from a nonce source or the cache (`inlineStyles.server.ts` decides that). It never renders an element that React
hoists:

- In the first HTML (the server render of the client component, and its hydration) it renders a
  `<style nonce data-umber-inline="<prefix> <href>...">` in place, with the texts of `shown` (all when it
  is absent). React does not hoist a style element with no `precedence`, so the element keeps its nonce
  and the policy lets it in with no script.
- At hydration it writes every text into an element of the head, with the nonce of the document, then
  renders nothing, so React removes the element in place.
- Mounted after the first HTML (the page of a client-side navigation) it renders nothing and writes its
  texts into the head with the document's nonce, so React never inserts an element with the nonce of the
  navigation's request, which the policy of the document refuses.

`readDocumentNonce(page)` gives the nonce the elements of the head are written with.

## Why it exists

A framework that gives React no style nonce (Next.js 16.4.6 gives it a string, the script nonce only)
makes React's merged `<style data-precedence>` element nonce-less, and a framework that makes a nonce for
each request sends a navigation's elements with a nonce the document does not allow. The element in place
answers the first; writing into the head with the document's nonce answers the second.

## The logic

```mermaid
flowchart TD
  props["prefix, texts, shown, nonce"] --> first{"server render or hydration? (useSyncExternalStore, kept by useState)"}
  first -->|yes| record["insertion effect: record the nonce of the props as the document's"]
  first -->|no| skip["record nothing: the nonce of the props is the navigation's"]
  record --> read["readDocumentNonce(document)"]
  skip --> read
  read --> found{"a nonce?"}
  found -->|no| none["write nothing"]
  found -->|yes| each["for each text, in order"]
  each --> held{"held already, or an element of the head with this href and a sheet?"}
  held -->|yes| next["nothing to write"]
  held -->|no| write["new style: nonce, data-precedence, data-href, the text of the props, after the last element of the prefix"]
  props --> handed{"every href held in an element with a sheet? (useSyncExternalStore)"}
  handed -->|"yes, or not the first HTML"| empty["render nothing"]
  handed -->|"no, first HTML"| inPlace["render style nonce data-umber-inline with the shown texts"]
```

`readDocumentNonce` looks, in order, at: the nonce recorded at hydration (the props of the first HTML came
with the payload of the document's own request), the `.nonce` of a `style[nonce]` that has a sheet (the
policy let it in), the `.nonce` of a `script[nonce]`. None of these: `undefined`.

## The data

- `held`: a module `Map` from an `href` to the element of the head that holds it: one this module wrote
  (kept even when the policy refused it, so it is not written again and again), or one of the page found
  with a sheet.
- `recordedNonce`: the nonce of the document, the first one recorded at hydration.
- The two `useSyncExternalStore` stores have nothing to subscribe to: whether a render is the first HTML
  is the server snapshot against the browser's, and whether the texts are handed changes only in the
  commit of the component itself (its insertion effect writes them), which React checks after a
  hydration and which a render after it reads.

## What it guarantees

- The text of an element it writes comes from its props only (the app's own server payload), never from
  an element of the page.
- An `href` counts as present only when its element has a sheet: an element that the policy refused (one
  injected with no nonce) holds no rule, so it can neither be applied again nor stand in for a rule.
- It writes new `<style>` elements with the document's nonce, never rules through `insertRule`: the CSP3
  specification gates CSSOM insertion on `'unsafe-eval'`; browsers do not enforce it today, and this does
  not rely on that gap.
- The element in place stays until the head holds every text in an element the policy let in: with no
  nonce found, or with what was written refused, the page keeps the styles of its first HTML.
- No flash at hydration: the head is written in the insertion effect, before the element in place goes,
  and both hold the same rules (scenario (h3) of `e2e/helpers/cspServer.ts`).
- The elements it writes have the form React gives its own (`data-precedence`, `data-href`), after the last
  element of the prefix, in the order of first use; `keepRootRule` of `ProviderScope.tsx` finds them.
- Hydration accepts the first HTML: the first render in the browser is the same as the server's.

## Decisions

- New elements carrying the document's nonce, not `insertRule` into an allowed sheet (see above).
- The nonce the props carry is used as the document's only at hydration: after it, the props come from the
  request of a navigation.
- With no nonce found nothing is written, rather than an element the policy would refuse and report.

## Limits

- With JavaScript off the element stays in place: as a child among the app's elements it shifts
  `:first-child`, `:nth-child` and `+`. Inside a `<select>` the HTML parser of the specification drops a
  `<style>`, so a styled `<option>` can be unstyled; Chromium 158 keeps it and applies it, other browsers
  were not run.
- A page whose first HTML hydrated no `NonceStyles`, and that has no applied style element or script with a
  nonce, writes nothing after a navigation: the classes only the navigation brings are unstyled, with no
  violation reported.
- `held` and the recorded nonce live as long as the page (the module).
