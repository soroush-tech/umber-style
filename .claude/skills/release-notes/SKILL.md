---
name: release-notes
description: 'How to write the release notes of a package of this repository (@umber-style/* or umber-style) - the file packages/<dir>/release-notes/<version>.md that cd-packages.yml publishes as the GitHub Release body: the semver bump, the heading, the issue and docs links as absolute URLs, the sections, and the checks that require the file. Use when releasing a package or drafting its release notes.'
paths: 'packages/**'
metadata:
  internal: true
---

# Package release notes

Notes live in a versioned file committed to the package: `packages/<dir>/release-notes/<version>.md`,
where `<version>` is the `version` of its `package.json` (the target, never a prerelease - the
`prerelease` skill). The file is plain Markdown. It never ships to npm: every publishable package
has `files: ["dist"]`.

## Bump the version first (semver)

A release is a new `version` in `package.json` and the matching notes file, in the same pull
request. The bump decides which sections the notes need:

| Bump      | `x.y.z` to | Use for                                                                   |
| --------- | ---------- | ------------------------------------------------------------------------- |
| **PATCH** | `x.y.Z+1`  | A backward-compatible fix; a maintenance or dependency-only change        |
| **MINOR** | `x.Y+1.0`  | Backward-compatible new features or new public API (patch back to 0)      |
| **MAJOR** | `X+1.0.0`  | Any change that breaks backward compatibility (minor and patch back to 0) |

Raising the peer range of `react`, `react-native` or `vue` past what consumers have is a break
(`docs/releasing.md`). The packages depend on each other by caret range (`workspace:^`, published
as `^<version>`): a patch or, from 1.0.0, a minor of a dependency reaches its dependents without a
release of theirs; under 1.0.0 a new minor of a dependency needs a release of each dependent.

## Required contents

1. **The heading `## <name>@<version>`** on the first line: `## @umber-style/core@0.1.0`,
   `## umber-style@0.1.0`. It is the only title the file carries.
2. **One line on what changed and why, then the issue as a full link** on the next line:
   `([#46](https://github.com/soroush-tech/umber-style/issues/46))`. Always the absolute URL, never a
   bare `#46`: the file is also read in the repository, where a bare reference is plain text.
3. **Only the sections that apply**, in this order: `### Added`, `### Changed`, `### Fixed`,
   `### BREAKING CHANGES` (what broke and how to migrate; its presence means a MAJOR bump),
   `### Packaging` (dependencies, peer ranges, what is bundled and what is not).
4. **A new public API names each export in bold code and links its page** in `docs/`, as an
   absolute `blob/main` URL so it resolves from the GitHub Release page:
   `[docs](https://github.com/soroush-tech/umber-style/blob/main/docs/<page>.md#<anchor>)`. The
   documentation of every package is in `docs/` at the repository root, never in a package. An
   item that belongs to an issue other than the lead one carries that issue's link too.

## Template

```markdown
## <name>@<version>

<one line: what changed and why>
([#<number>](https://github.com/soroush-tech/umber-style/issues/<number>))

### Added

- **`newExport`** - one line on what it does.
  ([#<number>](https://github.com/soroush-tech/umber-style/issues/<number>))
  [docs](https://github.com/soroush-tech/umber-style/blob/main/docs/<page>.md#<anchor>)

### Changed

- <a backward-compatible change of behaviour>.

### Fixed

- <a fix> ([#<number>](https://github.com/soroush-tech/umber-style/issues/<number>)).

### BREAKING CHANGES

- <what broke> - <how to migrate>.

### Packaging

- Depends on `@umber-style/core`, which is not bundled, so every package shares one engine.
- Peer dependency: `react` `^19.2.8`.
```

Match the tone of the files already there (`packages/*/release-notes/0.1.0.md`): plain sentences
that say what a consumer gets, ASCII punctuation only.

## The checks that require the file

- `pnpm check:release-notes` (`scripts/check-release-notes.mjs`), in the pre-commit hook and the CI
  `lint` job, fails when a publishable package has no notes file for its version. In the hook it
  also fails a commit that stages a change to a package whose version is not ahead of `latest` on
  npm (it warns and passes when the registry cannot be reached). A package you did not touch may
  stay at its published version.
- `cd-packages.yml` checks the notes file of every package of the run before it installs anything,
  and stops when one is missing.

## Cutting the release

1. In one pull request to `main`, with CI green: the new `version` and its notes file.
2. The owner dispatches Actions, **CD - Packages (npm)**, with the `package` and the `channel` (the
   `prerelease` skill for `alpha` and `rc`, and for the order of the packages).
3. The run publishes to npm (skipping a version already there) and, for `rc` and `stable`, creates
   the GitHub Release `<name>@<version>` with the notes file as its body. An rc uses the target's
   file (`0.2.0.md` for `0.2.0-rc.1`). A rerun creates a missing Release without publishing again.

Claude cannot push and the `gh` CLI is not installed: commit the version and the notes locally,
then ask the owner to push and to dispatch the workflow.
