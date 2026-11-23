# Guide

- [Forms and controls](#forms-and-controls)
- [Control state](#control-state)
- [Rules](#rules)
- [Messages, labels and i18n](#messages-labels-and-i18n)
- [HTML attributes as rules](#html-attributes-as-rules)
- [Binding to the DOM](#binding-to-the-dom)
- [Accessibility](#accessibility)
- [Async validation](#async-validation)
- [Schemas (Zod, Valibot, Yup, ArkType, …)](#schemas)
- [Submitting](#submitting)
- [Derived and input-less values](#derived-and-input-less-values)
- [TypeScript](#typescript)

## Forms and controls

A **form** holds one **control** per field name. You declare controls in code, let Formidate
discover them from the HTML, or both:

```ts
import { createForm, field } from 'formidate';

const form = createForm({ email: field().required().email() }); // declared
form.bind('#signup'); // undeclared named inputs in #signup become controls too
```

Every read (`form.values`, `form.controls`, `form.valid`, `form.getState()`) returns an
**immutable snapshot**. A snapshot keeps the same reference until something changes, and
unchanged controls keep theirs. That makes snapshots cheap to compare in any UI layer.

```ts
const stop = form.subscribe((state) => render(state)); // runs now, then after every change
```

## Control state

`form.controls.<name>` is a `ControlState`:

| Property           | Meaning                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `value`            | Current value: `string \| null`, `string[]` for lists, or an object/array for structured names (`a[b]`, `a[0]`) |
| `errors` / `error` | All error messages / the first one (`null` when valid)                                                          |
| `issues`           | Errors with their `path` inside the value (for object/array values)                                             |
| `pristine`         | The value equals its initial value                                                                              |
| `dirty`            | The value differs from its initial value (changing it back makes it pristine again)                             |
| `touched`          | The user focused the field and left it, or `touch()`/a submit marked it                                         |
| `untouched`        | Not touched yet                                                                                                 |
| `valid`            | Passes every rule and nothing is running                                                                        |
| `invalid`          | Fails at least one rule                                                                                         |
| `pending`          | A schema or async rule is running or waiting out its debounce, e.g. a "username available?" request             |
| `disabled`         | Excluded from validation and from the submitted values                                                          |
| `status`           | `'valid' \| 'invalid' \| 'pending' \| 'disabled'`                                                               |
| `label`            | The label used in messages                                                                                      |

While a control is `pending` it is neither `valid` nor `invalid`. A disabled control has no errors
and counts as valid.

The form-level `valid`, `invalid`, `pending`, `dirty` and `touched` aggregate the enabled controls.
`submitting` and `submitCount` track `handleSubmit`.

## Rules

`field(defaultValue?)` starts an **immutable** builder. Every method returns a new field, so shared
bases are safe:

```ts
const name = field().required().maxLength(80);
const form = createForm({ first: name.label('First name'), last: name.label('Last name') });
```

| Group        | Rules                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------- |
| Presence     | `required()`                                                                                  |
| Text         | `email()`, `url({ protocols })`, `pattern(re)`, `length(n)`, `minLength(n)`, `maxLength(n)`   |
| Numbers      | `number()`, `integer()`, `min(n)`, `max(n)`, `greaterThan(n)`, `lessThan(n)`, `multipleOf(n)` |
| Dates        | `date()`, `minDate(d)`, `maxDate(d)`                                                          |
| Choice       | `oneOf(values)`, `notOneOf(values)`                                                           |
| Lists        | `array(defaults?)`, `minItems(n)`, `maxItems(n)`                                              |
| Other fields | `sameAs(name)`                                                                                |
| Your own     | `custom(fn)`, `async(fn, { debounce })`                                                       |
| Schema       | `schema(standardSchema)`                                                                      |
| Label        | `label(text)`                                                                                 |

Every rule takes an optional message as its **last** argument: `minLength(8, 'Too short')`.

**Empty values pass.** `null`, `''` and `[]` pass every rule except `required` and `minItems`,
so `field().email()` means "optional, but must be an email if given". Inputs never produce `''`:
blank or whitespace-only text is stored as `null`.

**Rules behave like Zod.** Each built-in rule accepts and rejects the same strings as its Zod 4
equivalent (checked by `src/zod-parity.test.ts`), so nothing is surprisingly loose or strict:

| Rule                                                                        | Behaves like                                                                                                           |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `email()`                                                                   | `z.email()`: `asdf@gmail`, `a..b@x.com` and `" a@b.com "` fail                                                         |
| `url()`                                                                     | `z.httpUrl()`: `http`/`https` with a real domain; `https://google`, `localhost`, IPs and `javascript:` fail            |
| `url({ protocols: [], allowLocal: true })`                                  | `z.url()`: anything the URL parser accepts                                                                             |
| `number()`, `min()`, `max()`, `greaterThan()`, `lessThan()`, `multipleOf()` | `z.coerce.number()…`: `12`, `-1.5`, `.5`, `1e3`, `" 12 "`                                                              |
| `integer()`                                                                 | `z.coerce.number().int()`: `7`, `1.0`, `1e3`                                                                           |
| `date()`                                                                    | `z.iso.date()` / `z.iso.datetime({ local: true, offset: true })`: ISO only, real days only (`2024-02-30` fails)        |
| `length()`, `minLength()`, `maxLength()`                                    | `z.string().length/min/max()`: counts characters, so `"😀😀"` has length 2                                             |
| `oneOf()`                                                                   | `z.enum()`                                                                                                             |
| `pattern(re)`                                                               | `z.string().regex(re)`: unanchored, so add `^…$` yourself (the HTML `pattern` attribute is anchored, like in browsers) |

Where Formidate differs, it is on purpose:

- **Blank is empty.** A value of only spaces counts as "nothing typed": `required()` fails and every
  other rule passes it (`z.string().min(1)` accepts `"   "`).
- **No hex in number fields.** `"0x10"` fails `number()` (Zod's `Number()` coercion reads 16), as it
  does in an `<input type="number">`.
- `date()` also accepts `2024-05-31T14:30Z` and the space separator (`2024-05-31 14:30`), both valid ISO 8601.

Options and related behaviour:

- `email({ allowLocal: true })` accepts dotless hosts (`admin@localhost`); `email({ multiple: true })`
  accepts a comma-separated list.
- `url({ protocols: ['https'] })` narrows the schemes; `url({ allowLocal: true })` accepts
  `localhost` and IP addresses.
- `minDate`/`maxDate` compare **date-only values by calendar day** (local time), so
  `minDate(new Date())` means "today or later" and accepts today. Date-times compare by time.
- `min`/`max` are inclusive, like the HTML attributes. `greaterThan`/`lessThan` are exclusive.
- `setValue(name, true)` ticks a lone checkbox (the value becomes the box's `value`, e.g. `"on"`);
  `false` clears it.

**Lists.** `.array()` makes a control hold a `string[]`: a checkbox group, a `<select multiple>`, or
several inputs sharing a name. `required()` then means "at least one". Text, number and date rules
apply to **each element**:

```ts
field().array().required('Pick a topic').maxItems(3);
field().array().email(); // every entry must be an email
```

**Custom rules** return a message to fail, or `null`/`undefined` to pass. They also run on empty
values, which makes "required if…" rules possible:

```ts
field().custom((value, { values }) => (values.contact === 'phone' && !value ? 'Enter a phone number' : null));
```

**Object values** (from structured names like `address[zip]`) are checked as a whole only by
`required`, `custom`, `async`, `sameAs` and schemas. Each input inside them is still checked by its
own HTML attributes (see below). Validate the whole shape with a [schema](#schemas).

**Errors point at the entry.** Element-wise rules on a list report each failing entry with its path
(`issues: [{ message, path: [1] }]`), so error slots and `aria-invalid` land on the right row. Blank
entries don't count towards `required()` / `minItems()`.

## Messages, labels and i18n

Default messages are full sentences built around a label: "Email is required",
"Password must be at least 8 characters". A message is either a template or a function:

```ts
field().minLength(8, '{label} needs {min}+ characters');
field().min(18, (ctx) => `${ctx.label} must be 18 or older (got ${ctx.value})`);
```

Templates can use `{label}`, `{name}` and `{value}`, plus each rule's parameters (`{key:noun}`
adds a pluralized noun: `{min:character}` → "1 character" / "8 characters"): `{min}`,
`{max}`, `{length}`, `{limit}` (greaterThan/lessThan), `{step}` (multipleOf), `{values}`
(oneOf/notOneOf) and `{target}` (sameAs, which uses the other control's label). The default
text for every rule is listed in the [API reference](./api.md#messages).

**Labels** are resolved in this order:

1. `field().label('Email')`
2. The bound input's `<label>` text (a trailing `*` or `:` is removed), else the text of the
   elements its `aria-labelledby` points to, else `aria-label`. For a radio or checkbox group, the
   `<legend>` of its `<fieldset>`, else the name of a `role="group"` / `role="radiogroup"` container.
3. `fallbackLabel`, which defaults to `"This field"`.

**Translations.** Override messages per form, or globally with `configure`:

```ts
import { configure } from 'formidate';

configure({
  fallbackLabel: 'Ce champ',
  messages: { required: '{label} est obligatoire', email: '{label} doit être une adresse e-mail valide' },
});

createForm(fields, { messages: { required: 'Required' } }); // per form; wins over configure()
```

`configure()` affects forms created **after** it runs, so call it once at startup.

## HTML attributes as rules

With `html: true` (the default), `bind()` reads constraint attributes. An attribute is skipped when
the declared `Field` already has that kind of rule, so a rule you write (and its custom message)
always takes precedence; attributes of other kinds are added. Schema-backed controls are never
augmented.

Attributes describe **one input**, so inside lists and objects they apply per input:
`<input name="emails[]" type="email" required>` checks each row on its own, with the error at that
row (`path: [i]`) and the row's own `<label>`/`aria-label` in the message.

| Attribute                                | Rule                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `required` (on any input of the control) | `required()`                                                                                                                   |
| `type="email"`                           | `email()` (like `z.email()`, stricter than the browser; declare `email({ allowLocal: true })` to relax)                        |
| `type="email" multiple`                  | `email({ multiple: true })`                                                                                                    |
| `type="url"`                             | `url()` (like `z.httpUrl()`; browsers allow any scheme, incl. `javascript:`); declare `url({ protocols: [] })` to allow others |
| `type="number"` / `type="range"`         | `number()`, plus `min`/`max` → `min(n)`/`max(n)`; on number inputs `step` (default `1`, counted from `min`, `any` = off)       |
| `type="date"` / `type="datetime-local"`  | `date()`, plus `min`/`max` → `minDate`/`maxDate` (an unparsable `min`/`max` is ignored, as in browsers)                        |
| `type="time"` / `month` / `week`         | `min`/`max`, reported with the `minDate`/`maxDate` messages (an overnight `time` range such as `22:00`–`06:00` isn't checked)  |
| `minlength` / `maxlength`                | `minLength(n)` / `maxLength(n)`                                                                                                |
| `pattern`                                | `pattern(new RegExp('^(?:…)$', 'v'))`, anchored like the browser does                                                          |

Like browsers, **hidden and readonly inputs are never validated by their attributes** (rules you
declare in code still apply), and `<input type="number">` accepts whole numbers only unless you set
`step` (`step="0.01"`, `step="any"`). When a number or date input holds text the browser couldn't parse
(`12e` in `type="number"` reads as `''`), its `validity.badInput` is reported as "must be a number" /
"must be a valid date" instead of a misleading "is required".

Named inputs that you didn't declare become controls. Several checkboxes with the same name, or a
`<select multiple>`, become list controls. Buttons are ignored. Pass `{ html: false }` to only use
declared controls and rules.

> **Types:** controls discovered from HTML exist at runtime but not in the TypeScript type of a
> form created with declared fields. Declare a control if you need it typed.

## Binding to the DOM

```ts
const unbind = form.bind('#signup'); // an element or a CSS selector; returns unbind()
```

`bind()` works on any container. On a `<form>` it also handles `submit` and `reset`.

**Which value wins on bind.** If a control has a default (`field('en')`) or was set in code
(`setValue`, `reset(values)`), that value is **written into** the inputs. Otherwise the inputs'
current value is **read** and becomes the initial value, so server-rendered `value="…"` attributes
keep working. After that, user input flows into the form, and `setValue()`/`reset()` flow back into
the inputs.

**How inputs are read.** Values are read synchronously on `input` and `change` events:

| Input                                             | Value                                                           |
| ------------------------------------------------- | --------------------------------------------------------------- |
| text-like, `<textarea>`, `<select>`               | the string; blank → `null`                                      |
| single checkbox                                   | its `value` (`"on"` by default) when checked, else `null`       |
| radio group                                       | the checked radio's `value`, or `null`                          |
| checkbox group / `<select multiple>` / `.array()` | `string[]` of the checked/selected values                       |
| file                                              | the browser's file-name string (`File` objects are not exposed) |

Writing does the reverse: it checks the matching boxes and radios, selects options, and fills text
inputs (positionally for lists). Writing does not dispatch events, so frameworks that own an
input's value (React controlled inputs) won't see it. See [frameworks](./frameworks.md#react).

**Names create structure, the way servers parse them.** Brackets work like PHP, Rails and Express
(`qs`), so `form.values` matches what your backend receives; dots work too, and both can be mixed.
The first segment is the control name, the rest is a path; numeric segments are array indexes:

| Input names                                                | Value                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `address[street]`, `address[zip]` (or `address.zip`)       | `address: { street, zip }`                                                      |
| `items[0]`, `items[1]` (or `items.0`)                      | `items: ['…', '…']`                                                             |
| `rows[0][name]`, `rows[1][name]` (or `rows.0.name`)        | `rows: [{ name }, { name }]`                                                    |
| `emails[]` × 3 text inputs                                 | `emails: ['a@x.io', null, '…']` — one entry per input, in order, blank → `null` |
| `tags[]` × checkboxes / `<select name="langs[]" multiple>` | `tags: ['checked', …]`                                                          |
| `opts[0]`, `opts[k]` (an index mixed with a name)          | `opts: { 0: '…', k: '…' }` (an object, as `qs` and PHP build it)                |

Error slots use the same names, so `<p data-formidate-error="emails[]">` placed after each
`emails[]` input is the error for that row (the n-th slot ↔ the n-th input), and
`data-formidate-error="rows[0][name]"` targets one field of one row. Malformed names (`a[b`) are
flat keys. Names containing `__proto__`, `constructor` or `prototype` segments are ignored.

**A different control name.** `data-formidate-control` overrides `name`. Use it when the submitted
name can't match your control:

```html
<input name="user_email_v2" data-formidate-control="email" />
```

**Dynamic inputs (lists, conditional fields).** `bind()` watches the element with a
`MutationObserver`, so inputs added or removed later — by your code or by a framework re-render —
are picked up immediately, with their HTML rules:

- a new input joins its control (an `emails[]` row extends the list); a new name becomes a control;
- a removed input leaves its control (a list shrinks); controls created from HTML disappear with
  their last input, declared controls become empty (`null`, or `[]` for `.array()`);
- errors appear per input once that input was left, so a freshly added row stays quiet until the
  user has been in it (or a submit is attempted).

**Leaving a field with the mouse.** When the user leaves a field by pressing the mouse (or a finger)
somewhere in the form, its error appears when the button is released, not when it's pressed. If
the error appeared on press, the error text could push the button being clicked (often Submit) out
from under the pointer, and the browser would drop the click.

For a list, `name="emails[]"` needs no renumbering when rows are removed. Indexed names
(`rows[0][name]`) do: renumber the remaining rows in the same click handler. Call `form.refresh()`
after changing attributes such as `required` or `disabled`, which the observer doesn't watch.
`addFields()`/`removeFields()` add or remove rules from code; while bound, a removed control whose
inputs are still in the page comes back as an inferred control (with `html: true`), so remove its
inputs too. See `examples/dynamic.html`.

**Disabled.** Inputs that are disabled when you bind (including inside `<fieldset disabled>`) start
as disabled controls. Like `FormData`, a single disabled input in a list (one `emails[]` row, one
checked box) is left out of the value and not validated. `form.disable(name)` and `form.enable(name)` toggle a control and set the
inputs' `disabled` property. If you toggle `disabled` in the DOM yourself, call `form.refresh()`.

**`novalidate`.** A bound `<form>` gets `novalidate` so the browser's error bubbles don't compete
with yours. The native constraints still apply through the `html` option. `unbind()` restores the
attribute.

**Native submit gate.** If the form is invalid, a native submit is cancelled, every control is
marked touched and the first invalid input gets focus. If it is only waiting for async checks
(a "username available?" request), the submit is held: once the checks pass, the form is submitted
again (a new `submit` event, with the same submit button), and if one fails, its error shows
instead. A valid form submits normally. When `handleSubmit` handles the submit, it waits for the
checks itself and the gate doesn't submit again.

**Reset.** A native `reset` (e.g. `<button type="reset">`) resets the form state once the browser
has restored the inputs.

## Accessibility

With `aria: true` (the default), Formidate follows the WAI-ARIA error pattern and
[WCAG 3.3.1 (Error Identification)](https://www.w3.org/WAI/WCAG22/Understanding/error-identification):

- `aria-invalid="true"` is set on an input only once its control is **touched** and has an error
  for that input, so a screen reader doesn't call fields invalid before anyone has used them. It
  is removed when the error is fixed.
- **Error slots.** Elements with `data-formidate-error="<name>"` receive the first error message as
  text, once the input it belongs to was left (a container slot such as `address` only shows errors
  of the inputs left so far). They are `hidden` when there is no error, get an `id` if they don't
  have one, and that id is added to the matching inputs' `aria-describedby`. The name may be a
  path: `data-formidate-error="address.zip"`.
- After a failed submit, the first invalid input gets focus (`focusOnError: true`).

To have errors announced as they appear, add `aria-live="polite"` to your slots. Slots with
`aria-live` or a `role` are never `hidden` (a hidden live region is often not announced), only
emptied:

```html
<p data-formidate-error="email" aria-live="polite"></p>
```

Style errors with `[aria-invalid="true"] { border-color: crimson; }`. `unbind()` removes every
attribute Formidate added.

## Async validation

```ts
field()
  .required()
  .minLength(3)
  .async(
    async (value, { signal }) => {
      const res = await fetch(`/api/username-available?u=${encodeURIComponent(value!)}`, { signal });
      const { available } = await res.json();
      return available ? null : `${value} is taken`;
    },
    { debounce: 300 },
  );
```

- An async rule runs only when every sync rule (and the schema, if any) passes and the value is
  non-empty. A 2-letter username never reaches the server.
- It re-runs only when the control's own value changes, not when other fields change.
- When the value changes mid-flight, the earlier run's `signal` is aborted and its result is
  discarded. Pass `signal` to `fetch` to cancel the request itself.
- `debounce` delays the run until typing stops. The control is `pending` while it waits. If a field
  has several async rules, the longest debounce applies to all of them.
- Several async rules run in order, and the first message wins.
- If a rule throws (e.g. a network error), the control gets the `async` message:
  "{label} could not be verified".
- `form.validate()` and `handleSubmit` skip the debounce and wait for the result.

## Schemas

Any [Standard Schema](https://standardschema.dev) can validate a control: Zod (3.24+), Valibot,
Yup (1.7+), ArkType, Effect Schema and others. No adapter is needed; each library is covered by
`src/schemas.test.ts`. Pass it in place of a field, or attach it with `field().schema()`:

```ts
import { z } from 'zod';
import * as v from 'valibot';
import * as yup from 'yup';
import { type } from 'arktype';

const form = createForm({
  email: z.email('Enter a valid email'),
  website: v.nullable(v.pipe(v.string(), v.url())),
  nickname: yup.string().required('Pick a nickname').min(3),
  handle: type('string >= 3'),
  role: field()
    .label('Role')
    .schema(z.enum(['admin', 'user'])),
});
```

- Rules you chain on the field (`required()`, `sameAs`, `custom`, `async`, …) still run next to the
  schema, so `field().schema(z.string().nullable()).required()` is required. HTML-attribute rules
  are never added to schema fields: the schema is the source of truth.
- **The submitted value is the schema's output.** With `z.coerce.number()`, `handleSubmit` receives a
  `number`, and the type says so.
- **Empty inputs arrive as `null`.** A plain `z.string()` or `v.string()` reports a type error
  for an empty field. Use `.nullable()` / `v.nullable(...)` for optional fields, or give the
  schema a custom message.
- Async schemas work too. The control is `pending` while one runs, and a stale result is discarded.
  **Yup always validates asynchronously** through Standard Schema, so a Yup-backed control is briefly
  `pending` after each change; `handleSubmit` and `await form.validate()` wait for it.
- ArkType: put `.configure({ message })` on the constraint that fails (e.g. the piped
  `type('number >= 18')`), not on the outer type.

**Nested objects.** Build the value with structured input names (`address[zip]` or `address.zip`) and validate it as a whole. Each issue
keeps its path, so errors land on the right input and error slot:

```ts
const form = createForm({
  address: z.object({
    street: z.string().min(1, 'Street is required'),
    zip: z.string().regex(/^\d{5}$/, 'Enter a 5-digit ZIP'),
  }),
});
```

```html
<input name="address.street" /> <p data-formidate-error="address.street"></p>
<input name="address.zip" /> <p data-formidate-error="address.zip"></p>
```

`form.controls.address.issues` → `[{ message: 'Enter a 5-digit ZIP', path: ['zip'] }]`.
`aria-invalid` is set only on `address.zip`. An issue without a path (e.g. from an object-level
`refine`) marks every input of the control. A slot for the whole control
(`data-formidate-error="address"`) shows the first issue at any path, while a path slot shows only
issues at or below its path.

## Submitting

```ts
form.bind('#signup');
document.querySelector('#signup').addEventListener(
  'submit',
  form.handleSubmit(
    async (values) => api.save(values), // valid: the submitted values
    (state) => console.warn('Fix', state.controls), // invalid (optional)
  ),
);
```

`handleSubmit(onValid, onInvalid?)` returns an event handler that:

1. calls `preventDefault()`, and ignores the call if a submit is already running;
2. increments `submitCount`, sets `submitting` and marks every control touched;
3. runs `await form.validate()`, which re-reads the inputs (so values set without events, like
   autofill, count), skips debounces and waits for async rules and schemas;
4. calls `onValid(values)` if the form is valid. Otherwise it focuses the first invalid input and
   calls `onInvalid(state)`.

Disabled controls are left out of `values`. Errors thrown by your handlers are not swallowed: the
returned promise rejects. `submitting` is reset either way.

You can also validate without submitting: `if (await form.validate()) …`.

## Derived and input-less values

A control doesn't need an input. Set its value in code and it's validated, included in
`form.values`, and gates `handleSubmit`:

```ts
const form = createForm({
  price: field().required().number(),
  quantity: field().required().integer(),
  total: field().label('Total').greaterThan(0),
});

form.subscribe(({ values }) => {
  const total = String(Number(values.price) * Number(values.quantity));
  if (total !== form.values.total) form.setValue('total', total);
});
```

`setValue` turns numbers and booleans into strings and blank strings into `null`. It doesn't
mark the control touched; call `form.touch('total')` if your UI shows errors only for touched
controls. If you rely on native form submission, add an `<input type="hidden" name="total">` so
the browser sends it. Formidate writes the value into it.

## TypeScript

Types are inferred from the field map:

```ts
const form = createForm({
  email: field().required().email(),
  role: field().oneOf(['admin', 'user']),
  tags: field().array().minItems(1),
  age: z.coerce.number().int().min(18),
});

form.values.email; // string | null — what the control holds right now
form.controls.tags.value; // string[]

form.handleSubmit((values) => {
  values.email; // string            — required() removes null
  values.role; // 'admin' | 'user' | null — oneOf() narrows
  values.tags; // string[]
  values.age; // number            — the schema's output
});
```

`setValue`, `touch`, `disable`, … only accept declared names. Helper types such as `FormValues<F>`,
`FormOutput<F>`, `ControlState<V>` and `StandardSchemaV1` are exported. See the
[API reference](./api.md#types).
