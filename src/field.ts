import type { StandardSchemaV1 } from './standard-schema';
import type {
  AnyField,
  AsyncRule,
  AsyncRuleOptions,
  CustomRule,
  FieldValue,
  Message,
  RuleName,
} from './types';

/**
 * @internal A built-in rule. Element-wise rules (`each`) test every non-empty string — each entry of a
 * list — so failures can point at the entry; the others test the whole value.
 */
export type Rule = {
  readonly kind: RuleName;
  readonly params: Readonly<Record<string, unknown>>;
  readonly message: Message | undefined;
} & (
  | { readonly each: true; readonly test: (s: string) => boolean }
  | { readonly each: false; readonly test: (v: FieldValue) => boolean }
);

/** @internal Everything a `Field` describes. Read by `Form` via {@link defOf}. */
export interface FieldDef {
  readonly defaultValue: FieldValue | undefined;
  readonly array: boolean;
  readonly label: string | undefined;
  readonly rules: readonly Rule[];
  readonly sameAs: readonly { readonly target: string; readonly message: Message | undefined }[];
  readonly custom: readonly CustomRule[];
  readonly async: readonly { readonly rule: AsyncRule; readonly debounce: number }[];
  readonly schema: StandardSchemaV1 | undefined;
}

const EMPTY_DEF: FieldDef = {
  defaultValue: undefined,
  array: false,
  label: undefined,
  rules: [],
  sameAs: [],
  custom: [],
  async: [],
  schema: undefined,
};

// Definitions live outside the instance so they never show up in autocomplete or d.ts.
const defs = new WeakMap<object, FieldDef>();

/** @internal */
export const defOf = (field: AnyField): FieldDef => defs.get(field) ?? EMPTY_DEF;

// Email and URL hosts follow Zod (`z.email()`, `z.httpUrl()`): a local part without leading, trailing
// or doubled dots, and a dotted domain ending in a 2–63 letter top-level domain. `allowLocal` relaxes
// the host to dotless names and IPs (`admin@localhost`, `http://127.0.0.1`).
const LOCAL = "(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]";
const LABEL = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?';
const DOMAIN = `(?:${LABEL}\\.)+[A-Za-z]{2,63}`;
const EMAIL_RE = new RegExp(`^${LOCAL}@${DOMAIN}$`);
const LOCAL_EMAIL_RE = new RegExp(`^${LOCAL}@${LABEL}(?:\\.${LABEL})*$`);
const DOMAIN_RE = new RegExp(`^${DOMAIN}$`);

/** Plain decimal notation only (`12`, `-1.5`, `.5`, `1e3`); hex, binary and `Infinity` are not numbers here. */
const DECIMAL_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const toNumber = (s: string): number => (DECIMAL_RE.test(s.trim()) ? Number(s) : Number.NaN);

/** Length in characters (code points), so an emoji counts as one. */
const chars = (s: string): number => [...s].length;

/** Number of non-empty entries (blank list rows don't count); a non-list value counts as one. */
const count = (v: FieldValue): number =>
  Array.isArray(v) ? v.filter((x) => x !== null && x !== '').length : v === null || v === '' ? 0 : 1;

// Dates: ISO 8601 as produced by date inputs — `YYYY-MM-DD`, optionally `THH:mm[:ss[.sss]]` and an
// offset. The day must exist (no `2024-02-30`). Date-only values compare by calendar day.
const DATE_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

interface ParsedDate {
  /** `YYYY-MM-DD`: the calendar day (local for date-times with an offset). */
  day: string;
  /** Epoch ms, or `undefined` for date-only values. */
  time: number | undefined;
}

const pad = (n: number): string => String(n).padStart(2, '0');
const localDay = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseDate(s: string): ParsedDate | null {
  const m = DATE_RE.exec(s);
  if (!m) return null;
  const [y, mo, d, h, mi, sec] = [1, 2, 3, 4, 5, 6].map((i) => Number(m[i] ?? 0)) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const utc = new Date(Date.UTC(y, mo - 1, d));
  if (utc.getUTCMonth() !== mo - 1 || utc.getUTCDate() !== d || h > 23 || mi > 59 || sec > 59) return null;
  if (m[4] === undefined) return { day: s.slice(0, 10), time: undefined };
  const time = Date.parse(s.replace(' ', 'T')); // without an offset this is local time (ECMAScript)
  return { day: m[7] ? localDay(new Date(time)) : s.slice(0, 10), time };
}

function toLimit(limit: Date | string): ParsedDate {
  const parsed = limit instanceof Date ? { day: localDay(limit), time: limit.getTime() } : parseDate(limit);
  if (!parsed || Number.isNaN(parsed.time ?? 0))
    throw new Error(`[formidate] invalid date limit: ${String(limit)}`);
  return parsed;
}

/** Compare by calendar day if either side is date-only, else by time. */
const compareDates = (a: ParsedDate, b: ParsedDate): number =>
  a.time === undefined || b.time === undefined ? a.day.localeCompare(b.day) : a.time - b.time;

const showDate = (d: Date | string): string => (d instanceof Date ? localDay(d) : d);

export interface EmailOptions {
  /** Also accept dotless hosts such as `admin@localhost`. */
  allowLocal?: boolean;
  /** Accept a comma-separated list of addresses. */
  multiple?: boolean;
}

export interface UrlOptions {
  /** Allowed schemes, without `:`. Default `['http', 'https']`; `[]` allows any. */
  protocols?: readonly string[];
  /** Also accept dotless hosts such as `http://localhost`. */
  allowLocal?: boolean;
}

/** Narrow an output type to `U`, keeping `null` and array-ness. */
type Narrow<O, U> = O extends readonly unknown[] ? U[] : O extends null ? null : U;

/**
 * Immutable, chainable rule builder — every method returns a **new** `Field`, so a base field can be
 * shared and extended safely. Create one with {@link field}.
 *
 * Empty values (`null`, `''`, `[]`) pass every rule except `required` and `minItems`.
 * String rules apply to each element of an array value.
 *
 * @typeParam Value  - what the control holds
 * @typeParam Output - what `handleSubmit` receives when the form is valid
 */
export class Field<Value = string | null, Output = Value> {
  /** Type-only marker used for inference. Never set at runtime. */
  declare readonly '~types'?: { readonly value: Value; readonly output: Output };

  private next<V = Value, O = Output>(patch: Partial<FieldDef>): Field<V, O> {
    const f = new Field<V, O>();
    defs.set(f, { ...defOf(this), ...patch });
    return f;
  }

  private add(rule: Rule): Field<Value, Output> {
    return this.next({ rules: [...defOf(this).rules, rule] });
  }

  /** A whole-value rule. */
  private rule(
    kind: RuleName,
    params: Record<string, unknown>,
    message: Message | undefined,
    test: (v: FieldValue) => boolean,
  ): Field<Value, Output> {
    return this.add({ kind, params, message, each: false, test });
  }

  /** An element-wise rule: checks each non-empty string (each list entry); empty values pass. */
  private each(
    kind: RuleName,
    params: Record<string, unknown>,
    message: Message | undefined,
    test: (s: string) => boolean,
  ): Field<Value, Output> {
    return this.add({ kind, params, message, each: true, test });
  }

  // presence -------------------------------------------------------------

  /** Value must be present (non-blank; at least one item for arrays). */
  required(message?: Message): Field<Value, NonNullable<Output>> {
    return this.rule('required', {}, message, (v) => count(v) > 0) as Field<Value, NonNullable<Output>>;
  }

  // strings --------------------------------------------------------------

  /**
   * A valid email address, like Zod's `z.email()` (`a@example.com`; `a@gmail` fails). Options:
   * `allowLocal` also accepts dotless hosts such as `admin@localhost` (as browsers do); `multiple`
   * accepts a comma-separated list (like `<input type="email" multiple>`).
   */
  email(message?: Message): Field<Value, Output>;
  email(options: EmailOptions, message?: Message): Field<Value, Output>;
  email(options?: EmailOptions | Message, message?: Message): Field<Value, Output> {
    const opts = typeof options === 'object' ? options : {};
    const re = opts.allowLocal ? LOCAL_EMAIL_RE : EMAIL_RE;
    const one = (s: string) => re.test(s);
    return this.each('email', { ...opts }, typeof options === 'object' ? message : options, (s) =>
      opts.multiple ? s.split(',').every((part) => one(part.trim())) : one(s),
    );
  }

  /**
   * An absolute URL with a real domain, like Zod's `z.httpUrl()` (`https://example.com`;
   * `https://google` fails). `protocols` defaults to `['http', 'https']` (`[]` allows any);
   * `allowLocal` also accepts dotless hosts and IPs (`http://localhost`, `http://127.0.0.1`).
   */
  url(options?: UrlOptions, message?: Message): Field<Value, Output> {
    const protocols = options?.protocols ?? ['http', 'https'];
    const allowLocal = options?.allowLocal ?? false;
    return this.each('url', { protocols, allowLocal }, message, (s) => {
      let u: URL;
      try {
        u = new URL(s.trim());
      } catch {
        return false;
      }
      if (protocols.length > 0 && !protocols.includes(u.protocol.slice(0, -1))) return false;
      return allowLocal || u.hostname === '' || DOMAIN_RE.test(u.hostname); // no host: e.g. `mailto:`
    });
  }

  /** Must match the regular expression. */
  pattern(re: RegExp, message?: Message): Field<Value, Output> {
    return this.each('pattern', { pattern: re.source }, message, (s) => {
      re.lastIndex = 0;
      return re.test(s);
    });
  }

  length(n: number, message?: Message): Field<Value, Output> {
    return this.each('length', { length: n }, message, (s) => chars(s) === n);
  }

  minLength(n: number, message?: Message): Field<Value, Output> {
    return this.each('minLength', { min: n }, message, (s) => chars(s) >= n);
  }

  maxLength(n: number, message?: Message): Field<Value, Output> {
    return this.each('maxLength', { max: n }, message, (s) => chars(s) <= n);
  }

  // numbers --------------------------------------------------------------

  /** A number in decimal notation (`"12"`, `"-1.5"`, `".5"`, `"1e3"`). `"12abc"` and `"0x10"` fail. */
  number(message?: Message): Field<Value, Output> {
    return this.each('number', {}, message, (s) => Number.isFinite(toNumber(s)));
  }

  /** A whole number: `"7"`, `"-7"`, `"1.0"`, `"1e3"` (like Zod's `.int()`). */
  integer(message?: Message): Field<Value, Output> {
    return this.each('integer', {}, message, (s) => Number.isInteger(toNumber(s)));
  }

  /** `>= n` (inclusive, like the HTML `min` attribute). */
  min(n: number, message?: Message): Field<Value, Output> {
    return this.each('min', { min: n }, message, (s) => toNumber(s) >= n);
  }

  /** `<= n` (inclusive, like the HTML `max` attribute). */
  max(n: number, message?: Message): Field<Value, Output> {
    return this.each('max', { max: n }, message, (s) => toNumber(s) <= n);
  }

  /** `> n` (exclusive). */
  greaterThan(n: number, message?: Message): Field<Value, Output> {
    return this.each('greaterThan', { limit: n }, message, (s) => toNumber(s) > n);
  }

  /** `< n` (exclusive). */
  lessThan(n: number, message?: Message): Field<Value, Output> {
    return this.each('lessThan', { limit: n }, message, (s) => toNumber(s) < n);
  }

  multipleOf(step: number, message?: Message): Field<Value, Output> {
    return this.each('multipleOf', { step }, message, (s) => {
      const q = toNumber(s) / step;
      return Math.abs(q - Math.round(q)) < 1e-9;
    });
  }

  // dates ----------------------------------------------------------------

  /**
   * An ISO 8601 date (`2024-05-31`) or date-time (`2024-05-31T14:30`), as produced by date inputs.
   * The day must exist: `2024-02-30` fails.
   */
  date(message?: Message): Field<Value, Output> {
    return this.each('date', {}, message, (s) => parseDate(s) !== null);
  }

  /** On or after `d` (inclusive). Date-only values compare by calendar day, so `minDate(new Date())` accepts today. */
  minDate(d: Date | string, message?: Message): Field<Value, Output> {
    const limit = toLimit(d);
    return this.each('minDate', { min: showDate(d) }, message, (s) => {
      const v = parseDate(s);
      return v !== null && compareDates(v, limit) >= 0;
    });
  }

  /** On or before `d` (inclusive). Date-only values compare by calendar day. */
  maxDate(d: Date | string, message?: Message): Field<Value, Output> {
    const limit = toLimit(d);
    return this.each('maxDate', { max: showDate(d) }, message, (s) => {
      const v = parseDate(s);
      return v !== null && compareDates(v, limit) <= 0;
    });
  }

  // choice ---------------------------------------------------------------

  /** Must be one of `values`. Narrows the output type to the union of `values`. */
  oneOf<const T extends readonly string[]>(
    values: T,
    message?: Message,
  ): Field<Value, Narrow<Output, T[number]>> {
    const set = new Set<string>(values);
    return this.each('oneOf', { values }, message, (s) => set.has(s)) as Field<
      Value,
      Narrow<Output, T[number]>
    >;
  }

  notOneOf(values: readonly string[], message?: Message): Field<Value, Output> {
    const set = new Set<string>(values);
    return this.each('notOneOf', { values }, message, (s) => !set.has(s));
  }

  // arrays ---------------------------------------------------------------

  /**
   * Make this a multi-value control (`string[]`): a checkbox group, `<select multiple>`, or several
   * inputs sharing a name. `required()` then means "at least one".
   */
  array(defaults?: readonly string[]): Field<string[], string[]> {
    return this.next<string[], string[]>({ array: true, defaultValue: defaults ? [...defaults] : undefined });
  }

  minItems(n: number, message?: Message): Field<Value, Output> {
    return this.rule('minItems', { min: n }, message, (v) => count(v) >= n);
  }

  maxItems(n: number, message?: Message): Field<Value, Output> {
    return this.rule('maxItems', { max: n }, message, (v) => count(v) <= n);
  }

  // cross-field / custom / async -----------------------------------------

  /** Must equal the value of another control (e.g. password confirmation). */
  sameAs(target: string, message?: Message): Field<Value, Output> {
    return this.next({ sameAs: [...defOf(this).sameAs, { target, message }] });
  }

  /** Add a synchronous rule. Return a message to fail. Runs for empty values too. */
  custom(rule: CustomRule<Value>): Field<Value, Output> {
    return this.next({ custom: [...defOf(this).custom, rule as unknown as CustomRule] });
  }

  /**
   * Add an asynchronous rule (e.g. "username taken"). Runs only when every sync rule passes and the
   * value is non-empty; earlier runs are aborted through `ctx.signal` when the value changes.
   */
  async(rule: AsyncRule<NonNullable<Value>>, options?: AsyncRuleOptions): Field<Value, Output> {
    const entry = { rule: rule as unknown as AsyncRule, debounce: options?.debounce ?? 0 };
    return this.next({ async: [...defOf(this).async, entry] });
  }

  // schema / label -------------------------------------------------------

  /**
   * Validate with any [Standard Schema](https://standardschema.dev) (Zod, Valibot, Yup, ArkType, …).
   * Chained rules still run alongside it (HTML-attribute rules are not added). The submitted value is the
   * schema's output.
   */
  schema<S extends StandardSchemaV1>(schema: S): Field<Value, StandardSchemaV1.InferOutput<S>> {
    return this.next<Value, StandardSchemaV1.InferOutput<S>>({ schema });
  }

  /** Name used for `{label}` in messages, e.g. `"Email" is required`. */
  label(text: string): Field<Value, Output> {
    return this.next({ label: text });
  }
}

/**
 * Start a field definition.
 *
 * @example field().required().email()
 * @example field('en').oneOf(['en', 'fr'])
 */
export function field(defaultValue?: string | null): Field<string | null, string | null> {
  const f = new Field();
  if (defaultValue !== undefined) defs.set(f, { ...EMPTY_DEF, defaultValue });
  return f;
}
