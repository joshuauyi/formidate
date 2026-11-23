# Developing and releasing Formidate

This guide covers everything from a fresh clone to a published npm release.

- [1. Set up](#1-set-up)
- [2. Run the examples](#2-run-the-examples)
- [3. Develop](#3-develop)
- [4. Build](#4-build)
- [5. Versioning](#5-versioning)
- [6. Release to npm](#6-release-to-npm)
- [7. Troubleshooting](#7-troubleshooting)

## 1. Set up

**Requirements**

- **Node 24** (recommended; `.nvmrc` pins it) or Node 22.22+. The dev tools (Vitest, jsdom, tsdown,
  size-limit) need these versions. The published package itself supports Node ≥ 20.19.
- npm, which comes with Node. The repo uses `package-lock.json`, so don't use yarn or pnpm.

```sh
git clone git@github.com:joshuauyi/formidate.git
cd formidate
nvm use          # optional: switch to the Node version in .nvmrc
npm ci           # install exactly what package-lock.json lists
npm run check    # confirm everything passes before you change anything
```

**Project layout**

| Path                     | What it is                                                                   |
| ------------------------ | ---------------------------------------------------------------------------- |
| `src/index.ts`           | Public entry point (`formidate`)                                             |
| `src/form.ts`            | `createForm`, the `Form` store, DOM binding, submit gate, accessibility      |
| `src/field.ts`           | The `field()` rule builder                                                   |
| `src/dom.ts`             | Name parsing, reading/writing inputs, HTML attribute rules, labels           |
| `src/config.ts`          | Default messages and `configure()`                                           |
| `src/types.ts`           | Public types                                                                 |
| `src/standard-schema.ts` | Standard Schema interface (Zod, Valibot, Yup, ArkType, …)                    |
| `src/react/`             | The `formidate/react` entry point (`useForm`)                                |
| `src/*.test.ts(x)`       | Tests (Vitest + jsdom; `ssr.test.tsx` runs in plain Node)                    |
| `examples/`              | Browser pages for `npm run dev`                                              |
| `docs/`                  | User guide, API reference, framework recipes, design spec                    |
| `.changeset/`            | Pending release notes, plus pre-release state (`pre.json`, `pre/`)           |
| `.github/workflows/`     | `ci.yml` (checks on every push/PR), `release.yml` (versioning + npm publish) |
| `dist/` (generated)      | Build output: what gets published                                            |

## 2. Run the examples

```sh
npm run dev      # Vite dev server → http://localhost:5173
```

The pages import the library **source** (`src/`), so edits reload instantly. The one exception is
`cdn.html`, which loads the **built** `dist/formidate.iife.js`, so run `npm run build` first (or
again after changes). The README's [Try it in the browser](./README.md#try-it-in-the-browser)
section lists what each page shows.

## 3. Develop

**Day to day**

| Script                  | What it does                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `npm run test:watch`    | Re-run the tests on every save                                                      |
| `npm test`              | Run all tests once                                                                  |
| `npm run test:coverage` | Tests with a coverage report in `coverage/`                                         |
| `npm run lint`          | Biome lint + format check                                                           |
| `npm run lint:fix`      | Apply Biome fixes and formatting                                                    |
| `npm run typecheck`     | `tsc --noEmit`                                                                      |
| `npm run check`         | **Everything CI runs**: lint, typecheck, tests, build, size. Run it before every PR |

**Rules of the codebase**

- **No runtime dependencies.** The package ships zero dependencies. React is an optional peer
  dependency, used only by `formidate/react`.
- **Server-safe imports.** Nothing may touch `window`/`document` when a module loads or when
  `createForm()` runs. The DOM is only used inside `bind()` and event handlers.
  `src/ssr.test.tsx` runs without a DOM and fails if this breaks.
- **Size budget.** `npm run size` fails above the limits in `package.json` (`size-limit`). If a
  change needs more room, raise the limit in the same PR and say why.
- **Behaviour changes update the docs.** The contract lives in [docs/spec/v2.md](./docs/spec/v2.md).
  Update it, plus [docs/guide.md](./docs/guide.md) or [docs/api.md](./docs/api.md) as needed.
- **Tests with every fix.** Add a test that fails without your change. Browser-specific behaviour
  (focus, pointer, `validity.badInput`) is worth checking by hand in Chrome, Firefox and Safari via
  `npm run dev`.

**Try a local build in another app**

```sh
npm run build
npm pack                                        # → formidate-<version>.tgz
cd ../my-app && npm i ../formidate/formidate-<version>.tgz
```

This installs exactly what npm would publish, which `npm link` doesn't guarantee.

**Pull requests**

1. Branch from `dev`, make your change with tests, and run `npm run check`.
2. Add a changeset if users will notice the change (see [Versioning](#5-versioning)):
   `npm run changeset`. Commit the generated `.changeset/*.md` file with your change.
3. Open the PR into `dev`. CI (`.github/workflows/ci.yml`) runs on Node 22 and 24, tests React 18, and loads
   the built package on Node 20.19.

## 4. Build

```sh
npm run build
```

tsdown writes `dist/`:

| File                           | Used by                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `dist/index.js` + `index.d.ts` | `import … from 'formidate'` (ESM; Node ≥ 20.19 can `require()` it) |
| `dist/react.js` + `react.d.ts` | `import { useForm } from 'formidate/react'`                        |
| `dist/form-*.js`               | Code shared by both entry points                                   |
| `dist/formidate.iife.js`       | CDN `<script>` build that exposes `window.Formidate` (minified)    |
| `*.map`                        | Source maps                                                        |

The build also runs **publint** (package.json correctness) and **arethetypeswrong** (types resolve
for every consumer), and fails on any problem. To see exactly what would be published:

```sh
npm pack --dry-run
```

## 5. Versioning

Formidate follows [Semantic Versioning](https://semver.org): **major** for breaking changes,
**minor** for new features, **patch** for fixes.

**Where we are.** Version 1.x is the last stable release on npm (`latest` = 1.1.1). Version 2 is a
rewrite with a new API, so it's a new **major** version, released first as **betas** under the npm
`beta` dist-tag:

| Step                             | Version                           | npm dist-tag | Install                |
| -------------------------------- | --------------------------------- | ------------ | ---------------------- |
| Current stable                   | `1.1.1`                           | `latest`     | `npm i formidate`      |
| First v2 beta (this repo now)    | `2.0.0-beta.0`                    | `beta`       | `npm i formidate@beta` |
| Each later release while in beta | `2.0.0-beta.1`, `2.0.0-beta.2`, … | `beta`       | `npm i formidate@beta` |
| Stable v2                        | `2.0.0`                           | `latest`     | `npm i formidate`      |

`package.json` already says `2.0.0-beta.0`, and the 2.0 release notes are in `CHANGELOG.md`. While
the repo is in beta mode (`.changeset/pre.json` exists), every release bumps only the beta number,
whatever kind of changeset you add. `latest` stays on 1.1.1 until the stable release, so v1 users
aren't upgraded by accident.

**Version numbers come from changesets. Never edit them by hand.**

```sh
npm run changeset   # pick patch / minor / major and describe the change for users
```

This writes a file to `.changeset/`. Commit it with your change. On release, Changesets combines
the pending files into the version bump and the `CHANGELOG.md` entry.

**Going stable (2.0.0).** When the beta is ready:

```sh
npx changeset pre exit   # leave beta mode
npm run changeset        # e.g. a patch: "Formidate 2.0 is stable"
```

Commit both and merge to `main`. The next release is `2.0.0` under `latest`. Then remove `@beta`
from the README (install command, badges, CDN URL).

## 6. Release to npm

Releases run in GitHub Actions (`.github/workflows/release.yml`). Nobody publishes from a laptop.

### One-time setup (maintainer)

1. **npm trusted publishing.** On npmjs.com, open **formidate → Settings → Trusted publishing**
   and add a **GitHub Actions** publisher:
   - Organization or user: `joshuauyi`; repository: `formidate`
   - Workflow filename: `release.yml` (exactly; npm doesn't check this when you save)
   - Environment: `npm` (matches the workflow; leave it blank if you remove `environment:` there)
   - Allow **direct publishing with `npm publish`**. Changesets publishes that way, and new
     configurations only allow `npm stage publish` by default.

   This lets the workflow publish through GitHub's OIDC login, with no `NPM_TOKEN` secret, and adds
   [provenance](https://docs.npmjs.com/generating-provenance-statements) automatically. Publish
   within 2 days of creating the configuration, or create it again. Once a publish has worked,
   consider **Settings → Publishing access → Require two-factor authentication and disallow
   tokens**.
2. **GitHub → Settings → Actions → General:** enable **Allow GitHub Actions to create and approve
   pull requests** (needed for the "Version Packages" PR).
3. **Optional:** GitHub → Settings → Environments → `npm` → **Required reviewers**, so each publish
   waits for a maintainer's approval.

### How a release happens

On every push to `main`, the workflow chooses one mode:

| Situation on `main`                            | What the workflow does                                                                                          |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| There are pending changesets                   | Opens or updates a **"chore: version packages"** PR that bumps the version and the changelog                    |
| The version in `package.json` isn't on npm yet | Runs `npm run check`, packs, **publishes to npm**, pushes the `v<version>` git tag and creates a GitHub release |
| Nothing to release                             | Nothing                                                                                                         |

So the routine is:

1. Merge feature PRs (each with a changeset) into `dev`, then open a PR from `dev` into `main` and
   merge it when you want those changes released.
2. Review the "chore: version packages" PR that appears and merge it when you want to release.
3. That merge publishes. Watch **Actions → Release**.

**The first v2 beta.** `package.json` already says `2.0.0-beta.0` and the changelog entry exists,
so the first push of this work to `main` goes straight to the publish step. No version PR comes
first.

### Check a release

```sh
npm view formidate dist-tags     # beta → 2.0.0-beta.N, latest → 1.1.1 (until 2.0.0)
npm view formidate@beta version
```

jsDelivr serves the CDN build from npm automatically:
`https://cdn.jsdelivr.net/npm/formidate@beta/dist/formidate.iife.js`.

## 7. Troubleshooting

| Symptom                                           | Fix                                                                                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Publish fails with `E404`/`E403`/"not authorized" | The trusted publisher settings don't match: check the repository, `release.yml`, the environment name, and that direct `npm publish` is allowed |
| No "Version Packages" PR appears                  | Enable "Allow GitHub Actions to create and approve pull requests"; check that the changeset file was committed                                  |
| `npm run size` fails                              | The build grew past a limit in `package.json`: shrink the change, or raise the limit and say why                                                |
| `npm ci` fails with "lock file out of sync"       | Run `npm install` and commit `package-lock.json` (`npm run version-packages` keeps it in sync on releases)                                      |
| A release would go to `latest` too early          | It won't while `.changeset/pre.json` exists; only `npx changeset pre exit` moves releases to `latest`                                           |
