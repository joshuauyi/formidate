# Changelog

## 2.0.0-beta.0

### Major Changes

- Formidate 2.0 is a rewrite; see MIGRATION.md for upgrading from 1.x.

  - **Zero config:** `createForm().bind('#form')` validates a plain HTML form from its constraint
    attributes (`required`, `type`, `minlength`, `pattern`, …); undeclared inputs become controls.
  - **Typed, immutable `field()` builder** with Zod-compatible rules (`email()` ≈ `z.email()`,
    `url()` ≈ `z.httpUrl()`, ISO `date()`, …); messages are templates or functions, translatable via
    `configure()`.
  - **Standard Schema** support: Zod, Valibot, Yup, ArkType and others, with typed output.
  - **Store API:** immutable snapshots, `subscribe()` (works with React, Svelte, Vue), `validate()`,
    `handleSubmit()` with `submitting`/`submitCount`, `reset(values?)`.
  - **Async rules** with `AbortSignal` and debounce.
  - **DOM:** server-style names (`a[b]`, `a[0][b]`, `emails[]`), dynamic inputs picked up
    automatically, accessible errors (`aria-invalid`, `aria-describedby`, `[data-formidate-error]`),
    focus on the first invalid input, native submit/reset handling.
  - **React:** `useForm` from `formidate/react`.
  - **Packaging:** zero dependencies, ESM-only with types, CDN build `dist/formidate.iife.js`, ~8.5 kB.
