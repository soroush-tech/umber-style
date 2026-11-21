---
name: commit
description: 'How to write a git commit in this repository - a one-line Conventional Commits subject that says what is true after the commit and ends with its GitHub issue (`- #N`, or `- close #N` for the commit that completes it), signed, with no AI attribution. Use when committing work here.'
metadata:
  internal: true
---

# Commit

## The subject line is the whole message

Every commit is one line in the [Conventional Commits](https://www.conventionalcommits.org) form,
with no body and no footer:

```text
<type>[(<scope>)]: <what is true after the commit> - #<issue>
```

- **Type** - the ones this history uses:

  | Type       | Use for                                                       |
  | ---------- | ------------------------------------------------------------- |
  | `feat`     | A new feature or public API                                   |
  | `fix`      | A bug fix                                                     |
  | `refactor` | A code change that neither fixes a bug nor adds a feature     |
  | `test`     | Tests, the fixture apps and the end-to-end suite              |
  | `docs`     | Documentation only (`docs/`, the package README stubs)        |
  | `ci`       | The workflows and the composite setup action under `.github/` |
  | `build`    | The build and the publishing of the packages                  |
  | `chore`    | Maintenance that fits no other type                           |

- **Scope** - the folder of the one package the change is in (`core`, `react`, `react-native`,
  `vue`, `umber-style`, ...). No scope when the change spans packages or is not in one.
- **Description** - a statement of what holds after the commit, not the action taken: lower case
  first word, plain words, no trailing period. It may be long; a colon may introduce the parts.
  "the result of reading a media query has one named type", not "add MediaQueryResult type".
- ASCII punctuation only. The `commit-msg` hook runs `aiwg --message "$1" --fix`, which rewrites
  typographic punctuation in the message before the commit exists.

## The issue at the end of the subject

- A commit that works toward an issue ends with ` - #<N>`. Several issues: ` - #36 #47 #49`.
- The commit that completes an issue ends with ` - close #<N>`. Several: ` - close #22, close #23`.
- The reference goes at the end of the subject, never in a body or footer.
- A small chore or a docs change that belongs to no issue has no reference.
- Leave the issue open: `close #N` closes it when the commit reaches `main`. Never close it by hand.

## Examples from this history

```text
feat(react): useTheme is the one name in both builds: the nearest theme in a client component, the base theme in a server component - #46
fix(core): a function given to a helper of the theme inside a keyframes or global styles function throws, where two closures got one name - #12
refactor(react-native): the result of reading a media query has one named type - #44
test: keyframes and global styles in the fixture apps, end to end, with their documentation - close #12
feat: a theme is a scope boundary, and one rule can differ in a given theme or colour scheme - close #22, close #23
ci: the benchmark gate runs in the soroush-bench sandbox against the published package, and the custom gate is removed - #32
build: the five packages build with tsdown and publish through a manual release workflow with alpha, rc and stable channels - close #9
docs: the pages follow the new packages and the theme on :root, with a page for the cache and server packages
```

## No attribution

No `Co-Authored-By` trailer, no "Generated with" line, no mention of an AI tool, in a commit, a
pull request or an issue.

## Mechanics

- Commits are signed with the owner's GPG key; signing opens a pinentry dialog the owner confirms.
  Never pass `--no-gpg-sign` or `--no-verify`. If the dialog times out, retry when the owner is
  ready.
- The `pre-commit` hook (`.husky/pre-commit`) formats the staged files (`oxfmt-quick --staged`),
  checks their characters (`aiwg --staged --fix`: prose is fixed and re-staged, code is reported
  and stops the commit), runs `pnpm gen:publish-options --check` and
  `pnpm check:release-notes`, then `pnpm test`. A hook failure means the commit did not happen:
  fix the cause and commit again.
- `pnpm check:release-notes` fails a commit that stages a change to a publishable package whose
  version is not ahead of `latest` on npm: bump it and add its notes first (the `release-notes`
  skill).
- Commit on the branch the owner has checked out (the open pull request's branch). Claude cannot
  push: prepare the commit and ask the owner to run `git push`.
