# Using Formidate with frameworks

The core has no framework code. A form is a store:

- `form.getState()` returns an immutable snapshot, the same reference until something changes;
- `form.subscribe(listener)` calls `listener(state)` **immediately** and after every change, and
  returns an unsubscribe function.

Bind the form to the rendered `<form>` element and read the snapshot. Inputs stay **uncontrolled**:
Formidate reads them on `input`/`change` and writes them on `setValue`/`reset`.

## Vanilla JS

```js
import { createForm, field } from 'formidate';

const form = createForm({ email: field().required().email() });
form.bind('#signup');

form.subscribe(({ valid, submitting }) => {
  document.querySelector('#signup button').disabled = !valid || submitting;
});
document.querySelector('#signup').addEventListener('submit', form.handleSubmit(save));
```

For errors, use `<p data-formidate-error="email"></p>` slots and you don't need a render function at
all (see [Accessibility](./guide.md#accessibility)).

## React

```tsx
import { field } from 'formidate';
import { useForm } from 'formidate/react';

export function Signup() {
  const { ref, handleSubmit, controls, valid, submitting, form } = useForm({
    email: field().label('Email').required().email(),
    plan: field('free').oneOf(['free', 'pro']),
  });

  return (
    <form ref={ref} onSubmit={handleSubmit((values) => api.signup(values))}>
      <input name="email" type="email" />
      {controls.email.touched && controls.email.error && <p role="alert">{controls.email.error}</p>}

      <label>
        <input type="radio" name="plan" value="free" /> Free
      </label>
      <label>
        <input type="radio" name="plan" value="pro" /> Pro
      </label>

      <button type="button" onClick={() => form.reset()}>
        Reset
      </button>
      <button disabled={!valid || submitting}>Sign up</button>
    </form>
  );
}
```

- The hook creates the form **once**. Pass a `Form` instead to share one across components:
  `const form = createForm(fields); … useForm(form)`.
- The returned object comes from `useSyncExternalStore` and is immutable. Unchanged controls keep
  their identity, so passing `controls.email` to a memoized child is cheap.
- **Inputs should be uncontrolled.** Formidate writes values into the DOM directly (defaults,
  `setValue`, `reset`), and React overwrites DOM values it controls. Leave out `value`/`checked`
  props; Formidate fills in defaults from `field('…')`. For a custom component without a native
  input (date pickers, comboboxes), call `form.setValue(name, value)` from its `onChange`, or render
  a hidden `<input name="…">` that it updates.
- You can render errors yourself (as above) or use empty `<p data-formidate-error="email" />` slots.
  Don't do both for the same field.
- Requires React 18+. React 19 works, including ref cleanup.

## Vue 3

A small composable:

```ts
// useForm.ts
import { onMounted, onUnmounted, shallowRef, useTemplateRef } from 'vue';
import { createForm, type FieldsMap, type FormOptions } from 'formidate';

export function useForm<F extends FieldsMap>(fields: F, options?: FormOptions, refName = 'form') {
  const form = createForm(fields, options);
  const state = shallowRef(form.getState());
  const el = useTemplateRef<HTMLFormElement>(refName);
  let stop = () => {};

  onMounted(() => {
    stop = form.subscribe((s) => (state.value = s));
    if (el.value) form.bind(el.value);
  });
  onUnmounted(() => {
    stop();
    form.unbind();
  });

  return { form, state };
}
```

```vue
<script setup lang="ts">
import { field } from 'formidate';
import { useForm } from './useForm';

const { form, state } = useForm({ email: field().label('Email').required().email() });
const submit = form.handleSubmit((values) => api.signup(values));
</script>

<template>
  <form ref="form" @submit="submit">
    <input name="email" type="email" />
    <p v-if="state.controls.email.touched">{{ state.controls.email.error }}</p>
    <button :disabled="!state.valid">Sign up</button>
  </form>
</template>
```

`shallowRef` fits because snapshots are replaced, never mutated. Don't use `v-model` on bound
inputs; Formidate owns their values.

## Svelte

A `Form` satisfies the [Svelte store contract](https://svelte.dev/docs/svelte/stores#Store-contract),
because `subscribe` calls the listener synchronously with the current value and returns an
unsubscribe function. `$form` is therefore the current `FormState`:

```svelte
<script>
  import { createForm, field } from 'formidate';

  const form = createForm({ email: field().label('Email').required().email() });
  const bind = (node) => ({ destroy: form.bind(node) }); // a Svelte action
</script>

<form use:bind onsubmit={form.handleSubmit((values) => api.signup(values))}>
  <input name="email" type="email" />
  {#if $form.controls.email.touched}<p>{$form.controls.email.error}</p>{/if}
  <button disabled={!$form.valid}>Sign up</button>
</form>
```

`bind()` returns its unbind function, which is exactly what an action's `destroy` expects.

## Server rendering (Next.js, Nuxt, SvelteKit, Remix, Astro)

Formidate touches the DOM only in `bind()`, which every adapter above calls on mount, so the same
code renders on the server and hydrates in the browser:

- **On the server** `createForm` and `getState()` work as usual: default values, sync rules and
  schemas give the same snapshot the browser starts with, so hydration matches. `useForm` uses it
  as its server snapshot.
- **Async rules don't run during render.** Without a DOM they stay `pending` (as they are in the
  browser's first render) and start only when you call `validate()` or `handleSubmit()`. The browser
  starts them when the form is created there.
- **After hydration** `bind()` reads the inputs, so anything typed before the JavaScript loaded is
  kept.
- **Server-side validation** reuses the same fields: `form.setValues(data)`, then
  `await form.validate()` (async rules included) or `form.handleSubmit(save)()`.
- Create forms inside components (or per request), not at module scope: a module-level form on the
  server is shared by every request. Call `configure()` once at startup; it is global.
- `formidate/react` is a hook, so use it in client components (`'use client'` in Next.js App Router).

## Alpine, htmx, web components, server-rendered pages

Anything that renders a real `<form>` works with the zero-config path:

```html
<form id="contact" hx-post="/contact">
  <input name="email" type="email" required />
  <p data-formidate-error="email"></p>
  <button>Send</button>
</form>
<script type="module">
  import { createForm } from 'formidate';
  const form = createForm();
  form.bind('#contact');
  // htmx may handle the submit before Formidate's gate runs; cancel invalid requests explicitly:
  document.querySelector('#contact').addEventListener('htmx:beforeRequest', (e) => {
    if (!form.valid) e.preventDefault();
  });
</script>
```

- **htmx.** Use `htmx:beforeRequest` as shown above, because whether htmx respects the native
  submit gate depends on listener order. Without htmx, the gate alone blocks invalid submissions.
- **Alpine.** Call `bind` in `x-init`, e.g. `x-init="createForm().bind($el)"`, and read state with
  `form.subscribe` into Alpine data.
- **Web components.** Inside a shadow root, bind to the shadow root's `<form>`. Form-associated
  custom elements without a native input can be fed with `setValue`.
- **Re-rendered content.** When content is swapped (htmx), bind to the new element. `bind()` on a
  different element unbinds the old one first.
