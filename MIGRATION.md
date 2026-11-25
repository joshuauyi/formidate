# Migrating to Formidate v2

v2 is a rewrite. Most code changes are renames. The rest follow from four decisions:

1. **Named exports, no default object.** `import { createForm, field } from 'formidate'`.
2. **Immutable builders.** Every `field()` method returns a new field.
3. **Snapshots instead of live objects.** `form.controls.x` is a frozen `ControlState`, not a
   `FormControl` instance with setters.
4. **Standards.** Standard Schema replaces `rawRules`/`safeParse`. HTML attributes and ARIA are
   used by default.

The package is **ESM-only** (Node ≥ 20.19 can still `require()` it). The CDN file is now
`dist/formidate.iife.js`, exposing `window.Formidate.createForm` (no `.default`).

## From v1 (1.x)

The built-in rules now accept the same strings as their Zod 4 equivalents (`email()` ≈ `z.email()`,
`url()` ≈ `z.httpUrl()`, …); see [the guide](./docs/guide.md#rules).

### Entry points

| v1                                          | v2                                              |
| ------------------------------------------- | ----------------------------------------------- |
| `import Formidate from 'formidate'`         | `import { createForm, field } from 'formidate'` |
| `Formidate.group(constraints, prependName)` | `createForm(fields, options)`                   |
| `Formidate.constrain(default)`              | `field(default)`                                |
| `Formidate.control()` / `Formidate.rules()` | removed; use `field()`                          |
| `Formidate.addCustomType(name, fn)`         | `field().custom(fn)` or a schema                |
| `window.Formidate` set on import            | only in the CDN build                           |
| `dist/formidate.min.js`                     | `dist/formidate.iife.js`                        |

### Rules

| v1                                               | v2                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| `required(msg, allowEmpty)`                      | `required(msg)` (blank values are always `null`)                            |
| `email(msg)`                                     | `email(msg)`                                                                |
| `url(msg, schemes, allowLocal, allowDataUrl)`    | `url({ protocols, allowLocal }, msg)` (`data:` needs `protocols: ['data']`) |
| `matches(pattern, flags, msg)`                   | `pattern(/re/flags, msg)`                                                   |
| `length(n, msg)` / `minLength` / `maxLength`     | unchanged                                                                   |
| `lengthConfig(tokenizer, …)`                     | removed; use `custom()`                                                     |
| `number(msg, useStrict)`                         | `number(msg)` (always strict)                                               |
| `integer(msg)`                                   | unchanged                                                                   |
| `double()`                                       | `pattern(/\./)` or `custom()`                                               |
| `greaterThanOrEquals(n)` / `lessThanOrEquals(n)` | `min(n)` / `max(n)`                                                         |
| `greaterThan(n)` / `lessThan(n)`                 | unchanged                                                                   |
| `equals(n)`                                      | `oneOf([String(n)])`                                                        |
| `divisibleBy(n)`                                 | `multipleOf(n)`                                                             |
| `odd()` / `even()`                               | `custom()`                                                                  |
| `date(dateOnly, …)`                              | `date(msg)` (ISO 8601 dates and date-times)                                 |
| `beforeDate(d)` / `afterDate(d)`                 | `maxDate(d)` / `minDate(d)` (inclusive)                                     |
| `includes(list)` / `excludes(list)`              | `oneOf(list)` / `notOneOf(list)`                                            |
| `isType(type)`                                   | a schema                                                                    |
| `sameAs(name, msg, comparator)`                  | `sameAs(name, msg)`; use `custom()` for custom comparison                   |
| `custom((value, values, name) => …)`             | `custom((value, { values, name }) => …)`                                    |
| `customAsync(fn => resolve => …)`                | `async(async (value, { values, name, signal }) => message, { debounce })`   |
| `rawRules(validateJsRules)`                      | `schema(standardSchema)`                                                    |

### Messages

| v1                                             | v2                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| validate.js tokens `%{value}`                  | templates `{value}`, `{label}`, `{min}`, … or a function          |
| `prependName` (default `true`), `^` to opt out | messages are full sentences with `{label}`; set `.label('Email')` |

### Form

| v1 `FormGroup`                                        | v2 `Form`                                                             |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| `group.bind(form, ['input', 'focus', 'blur'])`        | `form.bind(formOrSelector)` (always listens to input/change/focusout) |
| `group.render(callback)`                              | `form.subscribe((state) => …)` (returns unsubscribe)                  |
| `group.get(name)` / `getControls()`                   | `form.controls[name]`                                                 |
| `group.updateValues(map)`                             | `form.setValues(map)` / `form.setValue(name, value)`                  |
| `group.touch` / `unTouch` / `touchAll` / `unTouchAll` | `form.touch(name?)` / `form.untouch(name?)`                           |
| `group.addControls` / `removeControls`                | `form.addFields` / `form.removeFields`                                |
| `group.reset()`                                       | `form.reset(values?)` (also resets the inputs)                        |
| —                                                     | `validate()`, `handleSubmit()`, `disable()`/`enable()`, `unbind()`    |

### Controls

| v1 `FormControl`                        | v2 `ControlState`                                                     |
| --------------------------------------- | --------------------------------------------------------------------- |
| `loading` / `isLoading()`               | `pending`                                                             |
| `hasError()`                            | `invalid`                                                             |
| `touchedAndHasError()` etc.             | `touched && invalid`                                                  |
| `getValue()` / `setValue()`             | `value` / `form.setValue(name, value)`                                |
| `setTouched`, `setErrors`, `setLoading` | removed (state is read-only)                                          |
| —                                       | `error`, `issues`, `dirty`, `pristine`, `disabled`, `status`, `label` |

### Inputs

- `formidate-control="x"` → `data-formidate-control="x"` (the bare attribute was invalid HTML).
- Checkbox groups and `<select multiple>` produce `string[]` (declare `.array()` for typing).
- Names are parsed like servers do: `tags[]` is a list, `address[zip]` / `address.zip` an object
  (`data-formidate-control` keeps a literal name).
- `validate.js` is no longer bundled; there are zero runtime dependencies.
