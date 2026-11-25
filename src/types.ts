import type { Field } from './field';
import type { StandardSchemaV1 } from './standard-schema';

/**
 * A control's value. Inputs produce strings (blank → `null`); lists (`name[]`, checkbox groups,
 * `<select multiple>`, `.array()`) produce arrays; structured names (`address[zip]`) produce objects.
 */
export type FieldValue = string | null | FieldValue[] | { [key: string]: FieldValue };

export type Values = Record<string, FieldValue>;

/** Built-in rule names — also the keys of {@link Messages}. */
export type RuleName =
  | 'required'
  | 'email'
  | 'url'
  | 'pattern'
  | 'length'
  | 'minLength'
  | 'maxLength'
  | 'number'
  | 'integer'
  | 'min'
  | 'max'
  | 'greaterThan'
  | 'lessThan'
  | 'multipleOf'
  | 'date'
  | 'minDate'
  | 'maxDate'
  | 'oneOf'
  | 'notOneOf'
  | 'minItems'
  | 'maxItems'
  | 'sameAs'
  | 'async';

/** Data available to a message template (`'{label} must be at least {min} characters'`) or function. */
export interface MessageContext {
  /** The control's label: `.label()`, the bound input's `<label>`, or the fallback label. */
  label: string;
  /** The control's name. */
  name: string;
  /** The current value. */
  value: FieldValue;
  /** Rule parameters: `min`, `max`, `length`, `limit`, `step`, `values`, `target`. */
  [param: string]: unknown;
}

/** A string template with `{placeholders}`, or a function building the message. */
export type Message = string | ((ctx: MessageContext) => string);

export type Messages = Record<RuleName, Message>;

/** A validation problem. `path` is relative to the control (empty for the control itself). */
export interface Issue {
  readonly message: string;
  readonly path: readonly (string | number)[];
}

export interface RuleContext {
  /** All current form values. */
  values: Values;
  /** The name of the control being validated. */
  name: string;
}

export interface AsyncRuleContext extends RuleContext {
  /** Aborted when the value changes or the form resets — pass it to `fetch`. */
  signal: AbortSignal;
}

/** Return an error message to fail; `null`/`undefined` to pass. */
export type CustomRule<V = FieldValue> = (value: V, ctx: RuleContext) => string | null | undefined;

/** Resolve to an error message to fail; `null`/`undefined` to pass. */
export type AsyncRule<V = FieldValue> = (
  value: V,
  ctx: AsyncRuleContext,
) => Promise<string | null | undefined> | string | null | undefined;

export interface AsyncRuleOptions {
  /** Wait this many ms after the last change before running. Default `0`. */
  debounce?: number;
}

// biome-ignore lint/suspicious/noExplicitAny: variance-free "any field" constraint
export type AnyField = Field<any, any>;

/** The field map passed to `createForm`: a `Field` or any Standard Schema per control. */
export type FieldsMap = Record<string, AnyField | StandardSchemaV1>;

/** Default field map for forms created without fields (zero-config / HTML-inferred). */
export type DynamicFields = Record<string, Field<FieldValue, FieldValue>>;

/** The value type a control holds. */
export type ValueOf<T> = T extends Field<infer V, infer _O> ? V : FieldValue;

/** The value type a control submits when valid. */
export type OutputOf<T> =
  T extends Field<infer _V, infer O>
    ? O
    : T extends StandardSchemaV1
      ? StandardSchemaV1.InferOutput<T>
      : never;

/**
 * Zero-config forms (`DynamicFields`) only learn their controls on `bind()`, so every name may be
 * missing (`controls.email?.error`). Forms with declared fields keep exact keys.
 */
type Known<F, T> = string extends keyof F ? Partial<T> : T;

export type FormValues<F extends FieldsMap> = Known<F, { [K in keyof F]: ValueOf<F[K]> }>;
export type FormOutput<F extends FieldsMap> = Known<F, { [K in keyof F]: OutputOf<F[K]> }>;

export type ControlStatus = 'valid' | 'invalid' | 'pending' | 'disabled';

/** Immutable snapshot of one control. */
export interface ControlState<V = FieldValue> {
  readonly name: string;
  readonly label: string;
  readonly value: V;
  /** All error messages (empty when valid or disabled). */
  readonly errors: readonly string[];
  /** The first error message, or `null`. */
  readonly error: string | null;
  /** Errors with their path inside the value (useful for object/array values). */
  readonly issues: readonly Issue[];
  readonly valid: boolean;
  readonly invalid: boolean;
  /** A schema or async rule is running or debouncing. */
  readonly pending: boolean;
  /** An input of this control lost focus, or `touch()`/submit was called. */
  readonly touched: boolean;
  readonly untouched: boolean;
  /** The value differs from the initial value. */
  readonly dirty: boolean;
  readonly pristine: boolean;
  readonly disabled: boolean;
  readonly status: ControlStatus;
}

/** Immutable snapshot of the whole form. Same reference until something changes. */
export interface FormState<F extends FieldsMap = DynamicFields> {
  readonly values: FormValues<F>;
  readonly controls: Known<F, { readonly [K in keyof F]: ControlState<ValueOf<F[K]>> }>;
  readonly valid: boolean;
  readonly invalid: boolean;
  readonly pending: boolean;
  readonly dirty: boolean;
  readonly touched: boolean;
  readonly submitting: boolean;
  readonly submitCount: number;
}

export interface FormOptions {
  /** Override default messages (i18n). Merged over `configure({ messages })`. */
  messages?: Partial<Messages>;
  /** Label used in messages when none is found. Default `"This field"`. */
  fallbackLabel?: string;
  /** On `bind`, create controls for undeclared inputs and turn HTML constraint attributes into rules. Default `true`. */
  html?: boolean;
  /** On `bind`, manage `aria-invalid`, `aria-describedby` and `[data-formidate-error]` elements. Default `true`. */
  aria?: boolean;
  /** Focus the first invalid input after a failed submit. Default `true`. */
  focusOnError?: boolean;
}

/** Minimal event shape accepted by `handleSubmit` (DOM `Event` or React `SyntheticEvent`). */
export interface PreventableEvent {
  preventDefault?: () => void;
}

export type SubmitHandler<F extends FieldsMap> = (
  values: FormOutput<F>,
  event?: PreventableEvent,
) => unknown | Promise<unknown>;

export type InvalidSubmitHandler<F extends FieldsMap> = (
  state: FormState<F>,
  event?: PreventableEvent,
) => unknown | Promise<unknown>;

export type Listener<F extends FieldsMap> = (state: FormState<F>) => void;
