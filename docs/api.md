# API reference

```ts
import { createForm, field, configure, Form, Field, DEFAULT_MESSAGES } from 'formidate';
import { useForm } from 'formidate/react';
```

All exports are named. The CDN build (`dist/formidate.iife.js`) exposes the same names on
`window.Formidate`.

- [`field()`](#field) · [Messages](#messages) · [`createForm()`](#createform) · [`Form`](#form)
- [`FormOptions`](#formoptions) · [`configure()`](#configure) · [State](#state) · [Types](#types)
- [`useForm()`](#useform-formidatereact)

## `field()`

```ts
field(defaultValue?: string | null): Field<string | null, string | null>
```

`Field<Value, Output>` is an immutable builder: every method returns a new `Field`. `Value` is the
type the control holds; `Output` is the type `handleSubmit` delivers when the form is valid.

Empty values (`null`, `''`, `[]`) pass every rule except `required` and `minItems`. Text, number
and date rules apply to each element of a list. `message` is always the optional last argument:
a template string or `(ctx: MessageContext) => string`.

| Method                                                            | Message key        | Notes                                                                                                                           |
| ----------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `required(message?)`                                              | `required`         | Non-blank; at least one item for lists. `Output` becomes non-null                                                               |
| `email(message?)` / `email({ allowLocal?, multiple? }, message?)` | `email`            | Like `z.email()` (`a@gmail` fails). `allowLocal` accepts dotless hosts; `multiple` a comma-separated list                       |
| `url(options?, message?)`                                         | `url`              | Like `z.httpUrl()`. `protocols` defaults to `['http', 'https']` (`[]` = any); `allowLocal` accepts `localhost` and IPs          |
| `pattern(re: RegExp, message?)`                                   | `pattern`          | `{pattern}` holds `re.source`                                                                                                   |
| `length(n, message?)`                                             | `length`           | Exactly `n` characters (code points; `{length}`)                                                                                |
| `minLength(n, message?)`                                          | `minLength`        | `{min}`                                                                                                                         |
| `maxLength(n, message?)`                                          | `maxLength`        | `{max}`                                                                                                                         |
| `number(message?)`                                                | `number`           | Like `z.coerce.number()`, minus hex (`0x10` fails)                                                                              |
| `integer(message?)`                                               | `integer`          | Like `z.coerce.number().int()` (`1.0`, `1e3` pass)                                                                              |
| `min(n, message?)`                                                | `min`              | `>= n` (`{min}`)                                                                                                                |
| `max(n, message?)`                                                | `max`              | `<= n` (`{max}`)                                                                                                                |
| `greaterThan(n, message?)`                                        | `greaterThan`      | `> n` (`{limit}`)                                                                                                               |
| `lessThan(n, message?)`                                           | `lessThan`         | `< n` (`{limit}`)                                                                                                               |
| `multipleOf(step, message?)`                                      | `multipleOf`       | Float-tolerant (`{step}`)                                                                                                       |
| `date(message?)`                                                  | `date`             | ISO 8601 date or date-time of a real day, like `z.iso.date()` / `z.iso.datetime()`                                              |
| `minDate(d: Date \| string, message?)`                            | `minDate`          | Inclusive (`{min}`). Date-only values compare by local calendar day, so `minDate(new Date())` accepts today. Invalid `d` throws |
| `maxDate(d: Date \| string, message?)`                            | `maxDate`          | Inclusive (`{max}`)                                                                                                             |
| `oneOf(values, message?)`                                         | `oneOf`            | Narrows `Output` to the union of `values` (`{values}`)                                                                          |
| `notOneOf(values, message?)`                                      | `notOneOf`         |                                                                                                                                 |
| `array(defaults?: string[])`                                      | —                  | Turns the field into `Field<string[], string[]>`; resets the default                                                            |
| `minItems(n, message?)`                                           | `minItems`         | Non-empty entries (blank list rows don't count)                                                                                 |
| `maxItems(n, message?)`                                           | `maxItems`         |                                                                                                                                 |
| `sameAs(name, message?)`                                          | `sameAs`           | Equal to another control's value; `{target}` is that control's label                                                            |
| `custom(rule)`                                                    | —                  | `(value, { values, name }) => string \| null \| undefined`; stackable; runs for empty values                                    |
| `async(rule, { debounce? })`                                      | `async` (on throw) | `(value, { values, name, signal }) => Promise<string \| null \| undefined>`; see [async](./guide.md#async-validation)           |
| `schema(schema)`                                                  | —                  | Any Standard Schema. Chained built-in rules still run (HTML-attribute rules are not added); `Output` becomes the schema output  |
| `label(text)`                                                     | —                  | Sets `{label}`                                                                                                                  |

## Messages

`DEFAULT_MESSAGES` (exported, read-only reference):

| Key           | Default                                      |
| ------------- | -------------------------------------------- |
| `required`    | `{label} is required`                        |
| `email`       | `{label} must be a valid email address`      |
| `url`         | `{label} must be a valid URL`                |
| `pattern`     | `{label} is not in the expected format`      |
| `length`      | `{label} must be exactly {length:character}` |
| `minLength`   | `{label} must be at least {min:character}`   |
| `maxLength`   | `{label} must be at most {max:character}`    |
| `number`      | `{label} must be a number`                   |
| `integer`     | `{label} must be a whole number`             |
| `min`         | `{label} must be at least {min}`             |
| `max`         | `{label} must be at most {max}`              |
| `greaterThan` | `{label} must be greater than {limit}`       |
| `lessThan`    | `{label} must be less than {limit}`          |
| `multipleOf`  | `{label} must be a multiple of {step}`       |
| `date`        | `{label} must be a valid date`               |
| `minDate`     | `{label} must be on or after {min}`          |
| `maxDate`     | `{label} must be on or before {max}`         |
| `oneOf`       | `{label} must be one of: {values}`           |
| `notOneOf`    | `{label} must not be {value}`                |
| `minItems`    | `{label} must have at least {min:item}`      |
| `maxItems`    | `{label} must have at most {max:item}`       |
| `sameAs`      | `{label} must match {target}`                |
| `async`       | `{label} could not be verified`              |

Every template can also use `{label}`, `{name}` and `{value}`. Lists are joined with `", "`. `{key:noun}`
writes a count with a pluralized noun (`{min:character}` → "1 character" / "8 characters"); for other
languages, override the message with your own template or a function.

## `createForm()`

```ts
createForm<F extends FieldsMap = DynamicFields>(fields?: F, options?: FormOptions): Form<F>
```

`fields` maps each control name to a `Field` or any Standard Schema. With no fields, controls come
from the bound HTML. They don't exist before `bind()` (or on the server), so their types are
optional: `form.controls.email?.error`.

## `Form`

### State (read-only)

| Member                                                | Type                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `getState()`                                          | `FormState<F>`: the same object until something changes                               |
| `values`                                              | `FormValues<F>`                                                                       |
| `controls`                                            | `{ [K in keyof F]: ControlState<ValueOf<F[K]>> }`                                     |
| `valid` / `invalid` / `pending` / `dirty` / `touched` | `boolean`, aggregated over enabled controls                                           |
| `subscribe(listener)`                                 | `(state) => void`; called immediately and after every change. Returns `unsubscribe()` |

`getState`, `subscribe`, `handleSubmit` and `unbind` are bound to the instance, so you can pass
them around (`useSyncExternalStore(form.subscribe, form.getState)`).

### Commands

| Method                              | Description                                                                                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `setValue(name, value)`             | Sets the value and validates. Written into bound inputs. Numbers/booleans become strings; blank becomes `null`                               |
| `setValues(partial)`                | Same for several controls; unknown names are ignored                                                                                         |
| `validate()`                        | `Promise<boolean>`: runs every rule, skips debounces, waits for async rules and schemas                                                      |
| `handleSubmit(onValid, onInvalid?)` | Returns `(event?) => Promise<void>`. See [Submitting](./guide.md#submitting)                                                                 |
| `reset(values?)`                    | Optionally sets new initial values, then restores them, clears touched/dirty/`submitCount`, cancels async rules and re-validates             |
| `touch(name?)` / `untouch(name?)`   | One control, or all of them                                                                                                                  |
| `disable(name)` / `enable(name)`    | Excludes/includes a control; sets the bound inputs' `disabled` property                                                                      |
| `addFields(fields)`                 | Adds or replaces controls; returns the form typed `Form<F & G>`                                                                              |
| `removeFields(...names)`            | While bound, controls whose inputs remain come back as inferred controls                                                                     |
| `bind(target: Element \| string)`   | Binds to a form or container. Returns `unbind`                                                                                               |
| `refresh()`                         | Re-scans the bound inputs (new/removed inputs, `required`/`disabled` attribute changes). Runs automatically when inputs are added or removed |
| `unbind()`                          | Removes listeners, `novalidate`, `aria-invalid` and the `aria-describedby` ids it added                                                      |

`onValid(values: FormOutput<F>, event?)`: disabled controls are left out of `values`.
`onInvalid(state: FormState<F>, event?)`.

## `FormOptions`

| Option          | Default        |                                                                                          |
| --------------- | -------------- | ---------------------------------------------------------------------------------------- |
| `messages`      | —              | `Partial<Messages>`, merged over `configure()` and the defaults                          |
| `fallbackLabel` | `"This field"` | Label used when none is set or found                                                     |
| `html`          | `true`         | On bind: create controls for undeclared inputs and turn constraint attributes into rules |
| `aria`          | `true`         | On bind: manage `aria-invalid`, `aria-describedby` and `[data-formidate-error]` slots    |
| `focusOnError`  | `true`         | Focus the first invalid input after a failed submit                                      |

## `configure()`

```ts
configure(options: FormOptions): void
```

Sets defaults for forms created afterwards. Messages are merged; other options are replaced.

## State

```ts
interface FormState<F> {
  values: FormValues<F>;
  controls: { [K in keyof F]: ControlState<ValueOf<F[K]>> };
  valid: boolean;
  invalid: boolean;
  pending: boolean;
  dirty: boolean;
  touched: boolean;
  submitting: boolean;
  submitCount: number;
}

interface ControlState<V> {
  name: string;
  label: string;
  value: V;
  errors: readonly string[];
  error: string | null;
  issues: readonly Issue[];
  valid: boolean;
  invalid: boolean;
  pending: boolean;
  touched: boolean;
  untouched: boolean;
  dirty: boolean;
  pristine: boolean;
  disabled: boolean;
  status: 'valid' | 'invalid' | 'pending' | 'disabled';
}

interface Issue {
  message: string;
  path: readonly (string | number)[];
}
```

All snapshots are frozen. Unchanged controls keep their previous object.

## Types

| Type                                                                                       |                                                                   |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `FieldValue`                                                                               | `string \| null \| FieldValue[] \| { [key: string]: FieldValue }` |
| `Values`                                                                                   | `Record<string, FieldValue>`                                      |
| `FieldsMap`                                                                                | `Record<string, Field \| StandardSchemaV1>`                       |
| `DynamicFields`                                                                            | Default field map for zero-config forms                           |
| `FormValues<F>` / `FormOutput<F>`                                                          | Held values / values delivered on submit                          |
| `ValueOf<T>` / `OutputOf<T>`                                                               | The same, for a single field                                      |
| `FormState<F>` / `ControlState<V>` / `ControlStatus` / `Issue`                             | Snapshots                                                         |
| `FormOptions` / `Messages` / `Message` / `MessageContext` / `RuleName`                     | Options and messages                                              |
| `CustomRule<V>` / `AsyncRule<V>` / `RuleContext` / `AsyncRuleContext` / `AsyncRuleOptions` | Your own rules                                                    |
| `SubmitHandler<F>` / `InvalidSubmitHandler<F>` / `PreventableEvent` / `Listener<F>`        | Handlers                                                          |
| `StandardSchemaV1`                                                                         | The Standard Schema v1 interface (types only)                     |

## `useForm()` — `formidate/react`

```ts
useForm<F>(fields?: F | Form<F>, options?: FormOptions): UseFormResult<F>
```

Creates the form once (later changes to `fields`/`options` are ignored), or uses the `Form` you
pass in. It subscribes through `useSyncExternalStore`. The result is the current `FormState`
spread, plus:

| Member         |                                                    |
| -------------- | -------------------------------------------------- |
| `form`         | The `Form` instance                                |
| `ref`          | Callback ref: `bind` on mount, `unbind` on unmount |
| `handleSubmit` | `form.handleSubmit`                                |

Requires React 18 or later.
