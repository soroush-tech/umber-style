---
name: component-tree
description: This app's component tree - its folders, what each holds, the files a component starts with - and where a new component goes. Load before creating, moving or extracting a component or a file.
metadata:
  generator: soroush.studio
  hash: 70597d7d
  facts: f5812214
---
# Component tree

Where things live in this app, and where a new component goes. soroush.studio reads the
Placement table when it makes a component (Make component, a section dragged out of a page):
edit its rows to change where components go, and keep its columns.

## Placement

<!-- soroush:placement v1 — read by soroush.studio; keep the columns, edit the rows -->

| Kind | Folder | Holds | Files |
| --- | --- | --- | --- |
| page | `src/pages` | route files only, never a component | - |
| part | beside its parent | a piece of one component | `<Name>.tsx` |

## Moves

| From | To | When |
| --- | --- | --- |
