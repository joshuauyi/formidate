# Formidate

[![CI](https://github.com/joshuauyi/formidate/actions/workflows/ci.yml/badge.svg)](https://github.com/joshuauyi/formidate/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/formidate/beta)](https://www.npmjs.com/package/formidate)
[![size](https://img.shields.io/bundlejs/size/formidate@beta?exports=createForm,field)](https://bundlejs.com/?q=formidate@beta&treeshake=[{createForm,field}])
[![license](https://img.shields.io/npm/l/formidate)](./LICENSE)

Tiny form validation that works with plain HTML, any framework, or none.

```js
import { createForm } from 'formidate';

createForm().bind('#signup'); // validates from the form's own HTML attributes
```

## Why

- **Zero config.** `required`, `type="email"`, `minlength`, `min`, `pattern` and friends become rules. No schema needed.
- **Small.** About 8.5 kB (minified + brotli), with zero dependencies.
- **Works anywhere.** It's plain DOM plus a store (`subscribe`/`getState`). A React hook ships in the package; Vue and Svelte need about five lines.
- **Works with schema libraries.** Pass any [Standard Schema](https://standardschema.dev) (Zod, Valibot, Yup, ArkType, …) instead of a field.
- **Accessible by default.** It sets `aria-invalid` and wires `aria-describedby` to your error elements, and focuses the first invalid input when a submit fails.
- **Typed.** Field names, values and the values you get on submit are inferred, including schema output types.

## Install

```sh
npm i formidate@beta
```

## Quick start

### 1. Plain HTML, zero config

```html
<form id="signup">
  <label for="email">Email</label>
  <input id="email" name="email" type="email" required />
  <p data-formidate-error="email"></p>

  <label for="password">Password</label>
  <input id="password" name="password" type="password" required minlength="8" />
  <p data-formidate-error="password"></p>

  <button>Sign up</button>
</form>

<script type="module">
  import { createForm } from 'formidate';
  createForm().bind('#signup');
</script>
```

Errors show after a field is left or a submit is attempted (e.g. "Email is required",
"Password must be at least 8 characters"). Invalid forms don't submit, and the first invalid
input gets focus. Valid forms submit natively.

### 2. Rules in code

```ts
import { createForm, field } from 'formidate';

const form = createForm({
  email: field().required().email(),
  password: field().required().minLength(8),
  confirm: field().label('Confirmation').sameAs('password'),
  username: field()
    .required()
    .async(
      async (value, { signal }) => {
        const res = await fetch(`/api/username-available?u=${encodeURIComponent(value)}`, { signal });
        return (await res.json()).available ? null : 'That username is taken';
      },
      { debounce: 300 },
    ),
});

form.bind('#signup');
document.querySelector('#signup')!.addEventListener(
  'submit',
  form.handleSubmit(async (values) => {
    await api.signup(values); // only runs when valid; values are typed
  }),
);
```

### 3. React

```tsx
import { field } from 'formidate';
import { useForm } from 'formidate/react';

function Login() {
  const { ref, handleSubmit, controls, submitting } = useForm({
    email: field().label('Email').required().email(),
    password: field().label('Password').required().minLength(8),
  });

  return (
    <form ref={ref} onSubmit={handleSubmit((values) => api.login(values))}>
      <input name="email" type="email" />
      {controls.email.touched && <p>{controls.email.error}</p>}
      <input name="password" type="password" />
      {controls.password.touched && <p>{controls.password.error}</p>}
      <button disabled={submitting}>Log in</button>
    </form>
  );
}
```

### 4. Vue and Svelte

A `Form` follows the Svelte store contract, so `$form.controls.email.error` just works. In Vue,
mirror the form into a `shallowRef` with `form.subscribe(...)`. Both recipes are in
[docs/frameworks.md](./docs/frameworks.md).

### 5. CDN

```html
<script src="https://cdn.jsdelivr.net/npm/formidate@beta/dist/formidate.iife.js"></script>
<script>
  Formidate.createForm().bind('#signup');
</script>
```

## Using a schema

```ts
import { z } from 'zod';

const form = createForm({
  email: z.email('Enter a valid email'),
  age: z.coerce.number().int().min(18), // submitted as a number
  address: z.object({ street: z.string().min(1), zip: z.string().regex(/^\d{5}$/) }),
});
// <input name="address.street"> <input name="address.zip"> <p data-formidate-error="address.zip">
```

## Documentation

| Topic                                                                       |                                                                                                                                     |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [Guide](./docs/guide.md)                                                    | Control state, rules, messages and translations, HTML attribute rules, DOM binding, accessibility, async rules, schemas, TypeScript |
| [API reference](./docs/api.md)                                              | Every export, method, option and type                                                                                               |
| [Frameworks](./docs/frameworks.md)                                          | Vanilla, React, Vue, Svelte, Alpine/htmx/web components                                                                             |
| [Migration](./MIGRATION.md)                                                 | From v1                                                                                                                             |
| [Design spec](./docs/spec/v2.md)                                            | Goals, prior art and the behaviour contract                                                                                         |
| [Changelog](./CHANGELOG.md) · [Developing and releasing](./CONTRIBUTING.md) |                                                                                                                                     |

## Try it in the browser

```sh
npm install
npm run build   # only needed for the CDN page
npm run dev     # → http://localhost:5173
```

| Page              | Shows                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `playground.html` | Every input type from HTML alone (incl. a `phones[]` list), live state table, API buttons     |
| `dynamic.html`    | Add/remove rows: `emails[]` and `guests[i][name]` lists, validated per row by HTML attributes |
| `vanilla.html`    | Sign-up form: HTML rules + async username check + `sameAs` + checkbox group                   |
| `zod.html`        | Nested `address.*` object validated by Zod, coerced number output                             |
| `react.html`      | `useForm` with uncontrolled inputs, a `phones[]` list rendered from React state, typed output |
| `cdn.html`        | The built `dist/formidate.iife.js` via `<script>`; also opens straight from disk              |

## Development

```sh
npm ci            # install (Node 24, or 22.22+)
npm run dev       # example pages at http://localhost:5173
npm run check     # lint, typecheck, tests, build, size: what CI runs
npm run changeset # describe a user-facing change for the next release
```

Releases are automated: merging the "version packages" PR on `main` publishes to npm. Setup,
versioning (v2 ships as `2.0.0-beta.N` under the `beta` tag until `2.0.0`) and the release steps
are in [CONTRIBUTING.md](./CONTRIBUTING.md).

## Browser and runtime support

Evergreen browsers (ES2020). The package is ESM-only; Node ≥ 20.19 can also `require()` it.
SSR-safe: nothing touches the DOM until `bind()`, async rules wait for the browser or `validate()`,
and server and client start from the same snapshot, so hydration matches
([details](./docs/frameworks.md#server-rendering-nextjs-nuxt-sveltekit-remix-astro)).

## License

[MIT](./LICENSE) © Joshua Uyi
