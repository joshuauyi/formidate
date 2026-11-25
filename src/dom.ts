import { defOf, Field, parseDate, type Rule } from './field';
import type { FieldValue, Issue, RuleName } from './types';

// Internal DOM helpers: reading/writing inputs, name parsing, HTML attribute rules, labels.

export type FormElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
export type Path = readonly (string | number)[];

const FIELD_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);
const BUTTON_TYPES = new Set(['submit', 'button', 'reset', 'image']);

// tagName checks (not instanceof) keep this working across realms (iframes).
export const isFormRoot = (el: Element): el is HTMLFormElement => el.tagName === 'FORM';

export function isFormElement(node: unknown): node is FormElement {
  const el = node as FormElement | null;
  return !!el && FIELD_TAGS.has(el.tagName) && !BUTTON_TYPES.has(el.type);
}

export const isCheckable = (el: FormElement): el is HTMLInputElement =>
  el.type === 'checkbox' || el.type === 'radio';
const isMultiSelect = (el: FormElement): el is HTMLSelectElement => el.type === 'select-multiple';

/** The control name of an input: `data-formidate-control` wins over `name`. */
export const nameOf = (el: FormElement): string => el.getAttribute('data-formidate-control') ?? el.name;

const UNSAFE_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);
const NAME_RE = /^([^.[\]]+)((?:\[[^[\]]*\]|\.[^.[\]]+)*)$/;
const SEGMENT_RE = /\[([^[\]]*)\]|\.([^.[\]]+)/g;

export interface ParsedName {
  key: string;
  path: Path;
  /** The name ends with `[]` — a list built from every input with this name, in order. */
  list: boolean;
}

/**
 * Parse an input name the way servers do (PHP, Rails, Express `qs`), plus dot notation:
 *
 * - `email` → email
 * - `address.zip` / `address[zip]` → address › zip
 * - `rows.0.name` / `rows[0][name]` → rows › 0 › name (numeric segments are array indexes)
 * - `emails[]` / `rows[0][tags][]` → a list (one entry per input, in document order)
 *
 * Malformed names (`a[b`, `a[][b]`) are flat keys. Names with a `__proto__` / `constructor` /
 * `prototype` segment are ignored (key `''`) so input names can never pollute prototypes.
 */
export function parseName(name: string): ParsedName {
  const m = NAME_RE.exec(name);
  const segments = m ? [...m[2]!.matchAll(SEGMENT_RE)].map((t) => t[1] ?? t[2]!) : [];
  const list = segments[segments.length - 1] === '';
  if (list) segments.pop();
  const ok = !!m && !segments.includes(''); // malformed (or `[]` before the end) → a flat key
  const key = ok ? m[1]! : name;
  const path = ok ? segments : [];
  if (UNSAFE_SEGMENTS.has(key) || path.some((seg) => UNSAFE_SEGMENTS.has(seg)))
    return { key: '', path: [], list: false };
  return { key, path: path.map((seg) => (/^\d+$/.test(seg) ? Number(seg) : seg)), list: ok && list };
}

/** Named, non-button fields of `root`, in document order (includes `form="id"` associated controls). */
export function elementsOf(root: Element): FormElement[] {
  const all = isFormRoot(root)
    ? Array.from(root.elements)
    : Array.from(root.querySelectorAll('input,select,textarea'));
  return all.filter((el): el is FormElement => isFormElement(el) && nameOf(el) !== '');
}

/**
 * Group fields by control. Like `FormData`, disabled inputs are left out of a control that still has
 * enabled ones (a fully disabled control keeps them, and is itself disabled).
 */
export function groupByKey(elements: FormElement[]): Map<string, FormElement[]> {
  const groups = new Map<string, FormElement[]>();
  for (const el of elements) {
    const { key } = parseName(nameOf(el));
    if (!key) continue;
    const list = groups.get(key);
    if (list) list.push(el);
    else groups.set(key, [el]);
  }
  for (const [key, els] of groups) {
    const enabled = els.filter((el) => !el.matches(':disabled'));
    if (enabled.length && enabled.length < els.length) groups.set(key, enabled);
  }
  return groups;
}

export interface Located<T> {
  item: T;
  key: string;
  path: Path;
  list: boolean;
}

/**
 * Resolve each item's location. In a `name[]` list, positional items (text inputs, error slots) get
 * their index in document order (`emails[]` → emails › 0, emails › 1, …); checkboxes and
 * `<select multiple>` stay one list.
 */
function locate<T>(
  items: readonly T[],
  nameFn: (item: T) => string,
  positional: (item: T) => boolean,
): Located<T>[] {
  const counters = new Map<string, number>();
  return items.map((item) => {
    const parsed = parseName(nameFn(item));
    if (!parsed.list || !positional(item)) return { item, ...parsed };
    const id = `${parsed.key}\u0000${parsed.path.join('.')}`;
    const index = counters.get(id) ?? 0;
    counters.set(id, index + 1);
    return { item, key: parsed.key, path: [...parsed.path, index], list: false };
  });
}

export const locateInputs = (els: readonly FormElement[]): Located<FormElement>[] =>
  locate(els, nameOf, (el) => !isCheckable(el) && !isMultiSelect(el));

export const locateSlots = (slots: readonly HTMLElement[]): Located<HTMLElement>[] =>
  locate(
    slots,
    (el) => el.getAttribute('data-formidate-error') ?? '',
    () => true,
  );

export interface PathGroup {
  path: Path;
  list: boolean;
  els: FormElement[];
}

/** Group a control's inputs by their (resolved) path inside the control. */
export function groupByPath(els: readonly FormElement[]): PathGroup[] {
  const map = new Map<string, PathGroup>();
  for (const { item, path, list } of locateInputs(els)) {
    const id = path.join('.');
    const group = map.get(id);
    if (group) {
      group.els.push(item);
      group.list ||= list;
    } else {
      map.set(id, { path, list, els: [item] });
    }
  }
  return [...map.values()];
}

/** Several checkboxes or a `<select multiple>` naturally hold a list. */
export const looksLikeArray = (els: FormElement[]): boolean =>
  els.some(isMultiSelect) || els.filter((el) => el.type === 'checkbox').length > 1;

const blankToNull = (s: string): string | null => (s.trim() === '' ? null : s);

function readGroup(els: FormElement[], asArray: boolean): FieldValue {
  if (asArray) {
    const out: string[] = [];
    for (const el of els) {
      if (isCheckable(el)) {
        if (el.checked) out.push(el.value);
      } else if (isMultiSelect(el)) {
        for (const opt of Array.from(el.selectedOptions)) out.push(opt.value);
      } else if (el.value.trim() !== '') {
        out.push(el.value);
      }
    }
    return out;
  }
  const checkables = els.filter(isCheckable);
  if (checkables.length > 0) return checkables.find((el) => el.checked)?.value ?? null;
  const el = els[els.length - 1]!;
  if (isMultiSelect(el)) return el.selectedOptions[0]?.value ?? null;
  return blankToNull(el.value);
}

/** Set `value` at `path`. Like `qs` and PHP, a name segment on an array (`a[0]` + `a[k]`) makes it an object. */
function setPath(root: FieldValue, path: Path, value: FieldValue): FieldValue {
  const [seg, ...rest] = path;
  if (seg === undefined) return value;
  // biome-ignore lint/suspicious/noExplicitAny: structural assembly of nested values
  let node: any = root !== null && typeof root === 'object' ? root : typeof seg === 'number' ? [] : {};
  if (Array.isArray(node) && typeof seg !== 'number') node = { ...node };
  node[seg] = setPath(node[seg] ?? null, rest, value);
  return node;
}

export function getPath(value: FieldValue, path: Path): FieldValue {
  let node: FieldValue | undefined = value;
  for (const seg of path) {
    if (node === null || typeof node !== 'object') return null;
    node = (node as Record<string | number, FieldValue>)[seg];
  }
  return node ?? null;
}

/** Read a control's value from its elements. */
export function readValue(els: FormElement[], asArray: boolean): FieldValue {
  const groups = groupByPath(els);
  const only = groups[0];
  if (groups.length === 1 && only && only.path.length === 0) return readGroup(els, asArray || only.list);
  let root: FieldValue = null;
  for (const g of groups) root = setPath(root, g.path, readGroup(g.els, g.list || looksLikeArray(g.els)));
  return root;
}

function writeGroup(els: FormElement[], value: FieldValue): void {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) return;
  const list = Array.isArray(value) ? value.map(String) : value === null ? [] : [value];
  let i = 0;
  for (const el of els) {
    // A boolean from code (`true` → 'true') ticks a lone checkbox whatever its `value`.
    if (isCheckable(el)) el.checked = list.includes(el.value) || (value === 'true' && els.length === 1);
    else if (isMultiSelect(el))
      for (const opt of Array.from(el.options)) opt.selected = list.includes(opt.value);
    else if (el.type !== 'file') el.value = Array.isArray(value) ? (list[i++] ?? '') : (value ?? '');
  }
}

/** Write a control's value into its elements (no events are dispatched). */
export function writeValue(els: FormElement[], value: FieldValue): void {
  for (const g of groupByPath(els)) writeGroup(g.els, g.path.length ? getPath(value, g.path) : value);
}

/** Does `path` start with `prefix` (`0` and `'0'` are the same segment)? */
export const startsWith = (path: Path, prefix: Path): boolean =>
  prefix.every((seg, i) => String(path[i]) === String(seg));

/** Does `issue` concern the input at `path`? Whole-value issues concern every input. */
export const issueTouchesInput = (issue: Issue, path: Path): boolean =>
  issue.path.length === 0 || startsWith(issue.path, path);

// labels ---------------------------------------------------------------------

const cleanText = (el: Element | null | undefined): string | null => {
  if (!el) return null;
  const clone = el.cloneNode(true) as Element;
  for (const n of Array.from(clone.querySelectorAll('[data-formidate-error],input,select,textarea')))
    n.remove();
  const text = (clone.textContent ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[\s*:]+$/, '')
    .trim();
  return text || null;
};

/** `aria-labelledby` text, else `aria-label`. */
const ariaName = (el: Element | null): string | null => {
  const ids = el?.getAttribute('aria-labelledby')?.split(/\s+/) ?? [];
  const text = ids.map((id) => (id ? cleanText(el!.ownerDocument.getElementById(id)) : null)).filter(Boolean);
  return text.join(' ') || (el?.getAttribute('aria-label') ?? null);
};

/**
 * Human label for a control: its `<label>`, else `aria-labelledby`/`aria-label`. A radio or checkbox
 * group uses its `<fieldset>`'s `<legend>`, else the name of its `role="group"`/`"radiogroup"` container.
 */
export function labelOf(els: FormElement[]): string | null {
  const first = els[0]!; // callers pass non-empty groups
  if (!(els.length > 1 && els.every(isCheckable))) return cleanText(first.labels?.[0]) ?? ariaName(first);
  return (
    cleanText(first.closest('fieldset')?.querySelector('legend')) ??
    ariaName(first.closest('[role=group],[role=radiogroup]')) ??
    ariaName(first)
  );
}

// HTML constraint attributes → rules ------------------------------------------

const compiles = (source: string, flags: string): boolean => {
  try {
    new RegExp(source, flags);
    return true;
  } catch {
    return false;
  }
};

/**
 * Compile a `pattern` attribute like browsers do: the unanchored source must be valid with the `v`
 * flag (else the attribute is ignored), then it is matched anchored. Engines without `v` use `u`.
 */
function patternOf(source: string): RegExp | null {
  const flags = compiles('', 'v') ? 'v' : 'u';
  return compiles(source, flags) ? new RegExp(`^(?:${source})$`, flags) : null;
}

/** Like browsers, hidden and readonly inputs are never validated by their attributes. */
const validatable = (el: FormElement): boolean => el.type !== 'hidden' && !(el as HTMLInputElement).readOnly;

/** Build rules from constraint attributes, skipping kinds already declared in `existing`. */
export function rulesFromAttributes(group: FormElement[], existing: ReadonlySet<RuleName>): Rule[] {
  const els = group.filter(validatable);
  const el = els.find((e) => !isCheckable(e)) ?? els[0];
  if (!el) return [];
  let f = new Field<FieldValue>();
  const want = (kind: RuleName) => !existing.has(kind);
  const attr = (name: string) => el.getAttribute(name);
  const num = (name: string) => {
    const v = attr(name);
    return v === null || v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v);
  };

  if (want('required') && els.some((e) => e.hasAttribute('required'))) f = f.required();

  const type = el.type;
  if (type === 'email' && want('email')) f = f.email({ multiple: (el as HTMLInputElement).multiple });
  if (type === 'url' && want('url')) f = f.url(); // http(s) only: a `javascript:` URL is not a link
  const extra: Rule[] = [];
  if (type === 'number' || type === 'range') {
    if (want('number')) f = f.number();
    const min = num('min');
    const max = num('max');
    if (min !== null && want('min')) f = f.min(min);
    if (max !== null && want('max')) f = f.max(max);
    // `step` (default 1, `any` = none) counts from `min`, as in browsers. Range inputs snap to it themselves.
    const by =
      attr('step')?.trim().toLowerCase() === 'any' ? null : (num('step') ?? 1) > 0 ? (num('step') ?? 1) : 1;
    if (type === 'number' && by !== null && want('multipleOf')) extra.push(stepRule(by, min ?? 0));
  }
  if (type === 'date' || type === 'datetime-local') {
    if (want('date')) f = f.date();
    // Like browsers, an unparsable `min`/`max` is ignored.
    const min = attr('min');
    const max = attr('max');
    if (min && parseDate(min) && want('minDate')) f = f.minDate(min);
    if (max && parseDate(max) && want('maxDate')) f = f.maxDate(max);
  }
  // Browser values of these types sort as strings. A reversed `time` range (overnight) is not checked.
  const order = ORDERED[type];
  const lo = attr('min');
  const hi = attr('max');
  if (order && !(type === 'time' && lo && hi && lo > hi)) {
    if (lo && order.test(lo) && want('minDate')) extra.push(rule('minDate', { min: lo }, (s) => s >= lo));
    if (hi && order.test(hi) && want('maxDate')) extra.push(rule('maxDate', { max: hi }, (s) => s <= hi));
  }
  const minLength = num('minlength');
  const maxLength = num('maxlength');
  if (minLength !== null && want('minLength')) f = f.minLength(minLength);
  if (maxLength !== null && want('maxLength')) f = f.maxLength(maxLength);
  const pattern = attr('pattern');
  const re = pattern ? patternOf(pattern) : null;
  if (re && want('pattern')) f = f.pattern(re);

  return [...defOf(f).rules, ...extra];
}

/** An element-wise rule reported with `kind`'s message. */
const rule = (kind: RuleName, params: Record<string, unknown>, test: (s: string) => boolean): Rule => ({
  kind,
  params,
  message: undefined,
  each: true,
  test,
});

/** `value = base + n × step` (float-tolerant), reported with the `multipleOf` message. */
const stepRule = (step: number, base: number): Rule =>
  rule('multipleOf', { step }, (s) => {
    const q = (Number(s) - base) / step;
    return Number.isNaN(q) || Math.abs(q - Math.round(q)) < 1e-9; // not a number: `number()` reports it
  });

const ORDERED: Record<string, RegExp> = {
  time: /^\d\d:\d\d(:\d\d(\.\d+)?)?$/,
  month: /^\d{4}-\d\d$/,
  week: /^\d{4}-W\d\d$/,
};

/**
 * Inputs whose typed text the browser can reject before it reaches `value` (`12e` in a number input
 * reads as `''`): their `validity.badInput` is the only way to know something was typed.
 */
const BAD_INPUT_TYPES: Record<string, 'number' | 'date'> = {
  number: 'number',
  date: 'date',
  'datetime-local': 'date',
  month: 'date',
  week: 'date',
  time: 'date',
};

export const badInputKind = (el: FormElement): 'number' | 'date' | undefined =>
  validatable(el) ? BAD_INPUT_TYPES[el.type] : undefined;

// aria-describedby bookkeeping ------------------------------------------------

export function addToken(el: Element, attr: string, token: string): boolean {
  const tokens = (el.getAttribute(attr) ?? '').split(/\s+/).filter(Boolean);
  if (tokens.includes(token)) return false;
  el.setAttribute(attr, [...tokens, token].join(' '));
  return true;
}

export function removeToken(el: Element, attr: string, token: string): void {
  const tokens = (el.getAttribute(attr) ?? '').split(/\s+/).filter((t) => t && t !== token);
  if (tokens.length) el.setAttribute(attr, tokens.join(' '));
  else el.removeAttribute(attr);
}
