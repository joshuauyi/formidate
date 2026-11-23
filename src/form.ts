import { formatMessage, type ResolvedOptions, resolveOptions } from './config';
import {
  addToken,
  badInputKind,
  elementsOf,
  type FormElement,
  getPath,
  groupByKey,
  groupByPath,
  isCheckable,
  isFormElement,
  isFormRoot,
  issueTouchesInput,
  type Located,
  labelOf,
  locateInputs,
  locateSlots,
  looksLikeArray,
  nameOf,
  type Path,
  parseName,
  readValue,
  removeToken,
  rulesFromAttributes,
  startsWith,
  writeValue,
} from './dom';
import { defOf, Field, type FieldDef, type Rule } from './field';
import type { StandardSchemaV1 } from './standard-schema';
import type {
  AnyField,
  ControlState,
  DynamicFields,
  FieldsMap,
  FieldValue,
  FormOptions,
  FormOutput,
  FormState,
  FormValues,
  InvalidSubmitHandler,
  Issue,
  Listener,
  Message,
  PreventableEvent,
  RuleName,
  SubmitHandler,
  Values,
} from './types';

/** "Not validated yet" marker for the schema/async caches. */
const UNSET: unique symbol = Symbol('unset');

interface SchemaRun {
  value: FieldValue | typeof UNSET;
  issues: Issue[];
  output: unknown;
  pending: boolean;
  token: number;
  promise: Promise<void> | undefined;
}

interface AsyncRun {
  value: FieldValue | typeof UNSET;
  error: string | null;
  pending: boolean;
  token: number;
  controller: AbortController | undefined;
  timer: ReturnType<typeof setTimeout> | undefined;
  start: (() => void) | undefined;
  promise: Promise<void> | undefined;
}

/** Internal state of one control. */
interface Entry {
  readonly name: string;
  readonly def: FieldDef;
  /** Created from an undeclared input (`html: true`); removed again with its last input. */
  readonly inferred: boolean;
  /** Rules from HTML attributes, per input path (`[]` = the control itself). */
  htmlRules: { path: Path; label: string | null; rules: Rule[] }[];
  /** Number/date inputs whose typed text the browser rejected (`validity.badInput`), checked live. */
  badInput: { el: HTMLInputElement; path: Path; kind: 'number' | 'date'; label: string | null }[];
  domLabel: string | null;
  value: FieldValue;
  initial: FieldValue;
  /** The value came from code; it is written into the inputs when they first connect. */
  explicit: boolean;
  /** Connected to inputs at least once (the initial value is settled). */
  attached: boolean;
  touched: boolean;
  /** `touch()` or a submit: every input of the control shows its errors. */
  touchedAll: boolean;
  /** Inputs that lost focus (by element, so a touched row stays with its row when others are removed). */
  touchedEls: WeakSet<Element>;
  disabled: boolean;
  /** `disable()`/`enable()` was called, so code wins over the DOM's `disabled`. */
  disabledByCode: boolean;
  sync: Issue[];
  schema: SchemaRun;
  async: AsyncRun;
  snapshot: ControlState | undefined;
}

const freshSchema = (): SchemaRun => ({
  value: UNSET,
  issues: [],
  output: undefined,
  pending: false,
  token: 0,
  promise: undefined,
});

const freshAsync = (): AsyncRun => ({
  value: UNSET,
  error: null,
  pending: false,
  token: 0,
  controller: undefined,
  timer: undefined,
  start: undefined,
  promise: undefined,
});

const isEmpty = (v: FieldValue): boolean => v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** Deep equality for field values (strings, `null`, arrays, plain objects); object key order doesn't matter. */
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b))
    return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((k) => equal((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  );
}

const sameList = <T>(a: readonly T[], b: readonly T[], eq: (x: T, y: T) => boolean = Object.is): boolean =>
  a.length === b.length && a.every((x, i) => eq(x, b[i]!));

const sameIssue = (a: Issue, b: Issue): boolean => a.message === b.message && sameList(a.path, b.path);

const isPromise = (v: unknown): v is PromiseLike<unknown> =>
  typeof (v as PromiseLike<unknown> | null)?.then === 'function';

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** Deep-freeze structured values so snapshots can't be mutated from outside. */
function freeze<T extends FieldValue>(v: T): T {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    for (const child of Object.values(v)) freeze(child);
    Object.freeze(v);
  }
  return v;
}

/**
 * Normalize a value from code: blank and `false` → `null`, numbers and `true` → strings (`true` ticks a
 * checkbox, see writeValue), structures copied and frozen.
 */
function normalize(v: unknown): FieldValue {
  if (v === undefined || v === null || v === false) return null;
  if (typeof v === 'string') return v.trim() === '' ? null : v;
  if (typeof v === 'number' || v === true) return String(v);
  return freeze(structuredClone(v) as FieldValue);
}

const toIssues = (issues: readonly StandardSchemaV1.Issue[]): Issue[] =>
  issues.map((i) => ({
    message: i.message,
    path: (i.path ?? []).map((seg) => {
      const key = typeof seg === 'object' ? seg.key : seg;
      return typeof key === 'number' ? key : String(key);
    }),
  }));

let errorIds = 0;

/** Add or remove the delegated input listeners on a root or an outside (`form="id"`) control. */
interface SlotOriginal {
  text: string;
  hidden: HTMLElement['hidden'];
  id: string;
}

function restoreSlot(slot: HTMLElement, original: SlotOriginal): void {
  slot.textContent = original.text;
  slot.hidden = original.hidden;
  if (original.id) slot.id = original.id;
  else slot.removeAttribute('id');
}

/**
 * A form: a set of controls, their validation state, and (optionally) a bound DOM element.
 * Create with {@link createForm}. All state reads return immutable snapshots.
 */
export class Form<F extends FieldsMap = DynamicFields> {
  private readonly entries = new Map<string, Entry>();
  private readonly options: ResolvedOptions;
  private readonly listeners = new Set<Listener<F>>();
  private state: FormState<F> | undefined;
  /** The last delivered snapshot: kept when nothing changed, so listeners aren't called for nothing. */
  private delivered: FormState<F> | undefined;
  private valuesCache: Values | undefined;
  private submitting = false;
  private submitCount = 0;
  private emitting = false;
  private emitAgain = false;

  // DOM binding
  private root: Element | null = null;
  /** `form="id"` controls outside the root, listened to directly. */
  private external = new Set<FormElement>();
  private observer: MutationObserver | undefined;
  private gateRun = 0;
  private held: EventTarget[] | undefined;
  private resetTimer: ReturnType<typeof setTimeout> | undefined;
  private addedNoValidate = false;
  private readonly ariaInvalid = new Set<Element>();
  private readonly describedBy = new Map<Element, Set<string>>();
  /** Original state of the error slots we wrote to, restored on unbind. */
  private readonly slots = new Map<HTMLElement, SlotOriginal>();

  constructor(fields?: F, options?: FormOptions) {
    this.options = resolveOptions(options);
    if (fields) for (const [name, f] of Object.entries(fields)) this.create(name, f, false);
    this.revalidate();
  }

  // state ---------------------------------------------------------------------------

  /** Current immutable snapshot. Returns the same object until something changes. */
  getState = (): FormState<F> => {
    if (this.state) return this.state;
    const controls: Record<string, ControlState> = {};
    const values: Values = {};
    let valid = true;
    let invalid = false;
    let pending = false;
    let dirty = false;
    let touched = false;
    const prev = this.delivered;
    let same = !!prev && Object.keys(prev.controls).length === this.entries.size;
    for (const e of this.entries.values()) {
      const c = this.controlState(e);
      controls[e.name] = c;
      same &&= (prev!.controls as Record<string, ControlState>)[e.name] === c;
      values[e.name] = e.value;
      if (c.disabled) continue;
      valid &&= c.valid;
      invalid ||= c.invalid;
      pending ||= c.pending;
      dirty ||= c.dirty;
      touched ||= c.touched;
    }
    if (same && prev!.submitting === this.submitting && prev!.submitCount === this.submitCount) {
      this.state = prev;
      return prev!;
    }
    this.state = Object.freeze({
      values: Object.freeze(values) as FormValues<F>,
      controls: Object.freeze(controls) as FormState<F>['controls'],
      valid,
      invalid,
      pending,
      dirty,
      touched,
      submitting: this.submitting,
      submitCount: this.submitCount,
    });
    return this.state;
  };

  get values(): FormValues<F> {
    return this.getState().values;
  }
  get controls(): FormState<F>['controls'] {
    return this.getState().controls;
  }
  get valid(): boolean {
    return this.getState().valid;
  }
  get invalid(): boolean {
    return this.getState().invalid;
  }
  get pending(): boolean {
    return this.getState().pending;
  }
  get dirty(): boolean {
    return this.getState().dirty;
  }
  get touched(): boolean {
    return this.getState().touched;
  }

  /**
   * Subscribe to state changes. The listener runs immediately with the current state and after every
   * change; returns an unsubscribe function. Satisfies `useSyncExternalStore` and the Svelte store contract.
   */
  subscribe = (listener: Listener<F>): (() => void) => {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  };

  // commands --------------------------------------------------------------------------

  /** Set one control's value (mirrored into bound inputs) and validate. */
  setValue<K extends keyof F & string>(name: K, value: FormValues<F>[K]): void {
    this.setValues({ [name]: value } as unknown as Partial<FormValues<F>>);
  }

  /** Set several values at once and validate. Unknown names are ignored. */
  setValues(values: Partial<FormValues<F>>): void {
    const groups = this.groups();
    for (const [name, value] of Object.entries(values)) {
      const e = this.entries.get(name);
      if (!e) continue;
      e.value = normalize(value);
      e.explicit = true;
      this.writeDom(e, groups);
    }
    this.revalidate();
  }

  /** After writing to checkboxes/radios, take the value they actually hold (`true` → the box's `value`). */
  private readBack(e: Entry, els: FormElement[]): void {
    if (els.length === 0 || !els.every(isCheckable)) return;
    const value = this.read(e, els);
    if (equal(e.initial, e.value)) e.initial = value;
    e.value = value;
  }

  /** Validate everything now (flushing debounced async rules) and resolve to the form's validity. */
  async validate(): Promise<boolean> {
    this.pull();
    this.revalidate();
    // Schemas can start async rules when they settle, so wait in rounds (bounded).
    for (let round = 0; round < 20; round++) {
      const waits: Promise<void>[] = [];
      for (const e of this.entries.values()) {
        if (e.async.start) {
          clearTimeout(e.async.timer);
          e.async.timer = undefined;
          e.async.start();
        }
        if (e.schema.pending && e.schema.promise) waits.push(e.schema.promise);
        if (e.async.pending && e.async.promise) waits.push(e.async.promise);
      }
      if (waits.length === 0) break;
      await Promise.all(waits);
    }
    return this.getState().valid;
  }

  /**
   * Wrap a submit handler. The returned function prevents the default action, ignores re-entry while
   * submitting, touches every control and waits for validation; then it calls `onValid(output)`, or
   * focuses the first invalid input and calls `onInvalid(state)`. Errors thrown by the handlers propagate.
   */
  handleSubmit = (
    onValid: SubmitHandler<F>,
    onInvalid?: InvalidSubmitHandler<F>,
  ): ((event?: PreventableEvent) => Promise<void>) => {
    return async (event?: PreventableEvent): Promise<void> => {
      event?.preventDefault?.();
      if (this.submitting) return;
      this.submitting = true;
      this.submitCount++;
      this.setTouched(undefined, true);
      try {
        if (await this.validate()) {
          await onValid(this.output(), event);
        } else {
          if (this.options.focusOnError) this.focusFirstInvalid();
          await onInvalid?.(this.getState(), event);
        }
      } finally {
        this.submitting = false;
        this.emit();
      }
    };
  };

  /** Restore initial values (optionally replacing them first), clear touched/dirty/submitCount and revalidate. */
  reset(values?: Partial<FormValues<F>>): void {
    const groups = this.groups();
    for (const e of this.entries.values()) {
      if (values && e.name in values) {
        e.initial = normalize((values as Values)[e.name]);
        e.explicit = true;
      }
      this.cancelAsync(e);
      e.value = e.initial;
      e.touched = e.touchedAll = false;
      e.touchedEls = new WeakSet();
      e.schema = freshSchema();
      e.async = freshAsync();
      this.writeDom(e, groups);
    }
    this.submitCount = 0;
    this.revalidate();
  }

  /** Mark one control (or all, when omitted) as touched. */
  touch(name?: keyof F & string): void {
    this.setTouched(name, true);
  }

  /** Mark one control (or all, when omitted) as untouched. */
  untouch(name?: keyof F & string): void {
    this.setTouched(name, false);
  }

  /** Exclude a control from validation and submitted output (bound inputs get `disabled`). */
  disable(name: keyof F & string): void {
    this.setDisabled(name, true);
  }

  enable(name: keyof F & string): void {
    this.setDisabled(name, false);
  }

  /** Add (or replace) controls. */
  addFields<G extends FieldsMap>(fields: G): Form<F & G> {
    for (const [name, f] of Object.entries(fields)) this.create(name, f, false);
    if (this.root) this.refresh();
    else this.revalidate();
    return this as unknown as Form<F & G>;
  }

  removeFields(...names: (keyof F & string)[]): void {
    for (const name of names) {
      const e = this.entries.get(name);
      if (e) this.cancelAsync(e);
      this.entries.delete(name);
    }
    // While bound, inputs still in the page come back as inferred controls (`html: true`).
    if (this.root) this.refresh();
    else this.revalidate();
  }

  // DOM -------------------------------------------------------------------------------

  /**
   * Bind to a `<form>` (or any container), by element or CSS selector: reads and writes input values,
   * tracks touched state, infers rules from HTML attributes, wires accessible errors, follows inputs
   * added or removed later, and gates native submission. Returns an unbind function.
   */
  bind(target: Element | string): () => void {
    const root = typeof target === 'string' ? document.querySelector(target) : target;
    if (!root) throw new Error(`[formidate] bind(): no element matches "${String(target)}"`);
    if (root === this.root) return this.unbind;
    this.unbind();
    this.root = root;

    if (isFormRoot(root) && !root.noValidate) {
      root.noValidate = true;
      this.addedNoValidate = true;
    }
    // On the root, not the document: a form removed without unbind() is then garbage-collected.
    this.listen(root, true);
    this.observer = new MutationObserver(this.onMutations);
    this.observer.observe(root, { childList: true, subtree: true });
    this.refresh();
    return this.unbind;
  }

  /**
   * Re-scan the bound inputs: new inputs join (or create) controls, controls inferred from inputs that
   * are gone are removed, and labels, HTML rules and `disabled` are re-read. Runs automatically when
   * inputs are added or removed; call it after changing attributes such as `required` or `disabled`.
   */
  refresh(): void {
    const root = this.root;
    if (!root) return;
    const all = elementsOf(root);
    const outside = new Set(all.filter((el) => !root.contains(el)));
    for (const el of this.external) this.listen(el, false);
    for (const el of outside) this.listen(el, true);
    this.external = outside;
    const groups = groupByKey(all);
    for (const [key, els] of groups) {
      const e =
        this.entries.get(key) ?? (this.options.html ? this.create(key, new Field(), true) : undefined);
      if (e) this.attach(e, els);
    }
    for (const e of this.entries.values()) {
      if (groups.has(e.name) || !e.attached) continue; // input-less (derived) controls keep their value
      if (e.inferred) {
        this.cancelAsync(e);
        this.entries.delete(e.name);
      } else {
        // All inputs removed (e.g. the last list row): empty, as if it never had inputs.
        e.value = e.def.array ? freeze([]) : null;
        e.htmlRules = [];
        e.badInput = [];
      }
    }
    this.revalidate();
  }

  /** Detach from the bound element and undo everything Formidate added to it. */
  unbind = (): void => {
    const root = this.root;
    if (!root) return;
    for (const el of [root, ...this.external]) this.listen(el, false);
    this.external.clear();
    this.observer?.disconnect();
    this.observer = undefined;
    clearTimeout(this.resetTimer);
    this.held = undefined;
    for (const e of this.entries.values()) {
      e.attached = false; // a later bind() starts fresh
      this.cancelAsync(e); // no requests for an unmounted form; re-run on the next bind() or validate()
      e.async = freshAsync();
    }
    if (this.addedNoValidate && isFormRoot(root)) root.noValidate = false;
    this.addedNoValidate = false;
    for (const el of this.ariaInvalid) el.removeAttribute('aria-invalid');
    this.ariaInvalid.clear();
    for (const [el, ids] of this.describedBy) for (const id of ids) removeToken(el, 'aria-describedby', id);
    this.describedBy.clear();
    for (const [slot, original] of this.slots) restoreSlot(slot, original);
    this.slots.clear();
    this.root = null;
    this.emit();
  };

  // internals: controls ---------------------------------------------------------------

  private create(name: string, f: AnyField | StandardSchemaV1, inferred: boolean): Entry {
    const old = this.entries.get(name);
    if (old) this.cancelAsync(old);
    const def = defOf(f instanceof Field ? f : new Field().schema(f));
    const value = normalize(def.defaultValue ?? (def.array ? [] : null));
    const e: Entry = {
      name,
      def,
      inferred,
      htmlRules: [],
      badInput: [],
      domLabel: null,
      value,
      initial: value,
      explicit: def.defaultValue !== undefined,
      attached: false,
      touched: false,
      touchedAll: false,
      touchedEls: new WeakSet(),
      disabled: false,
      disabledByCode: false,
      sync: [],
      schema: freshSchema(),
      async: freshAsync(),
      snapshot: undefined,
    };
    this.entries.set(name, e);
    return e;
  }

  /** Connect a control to its inputs: label, HTML rules, `disabled`, value. Idempotent (runs on every refresh). */
  private attach(e: Entry, els: FormElement[]): void {
    e.domLabel = labelOf(els);
    // Attributes describe one input, so their rules apply per input path (each `emails[]` row).
    const declared = new Set<RuleName>(e.def.rules.map((r) => r.kind));
    e.htmlRules =
      this.options.html && !e.def.schema
        ? groupByPath(els)
            .map((g) => ({
              path: g.path,
              label: g.path.length ? labelOf(g.els) : null,
              rules: rulesFromAttributes(g.els, declared),
            }))
            .filter((g) => g.rules.length > 0)
        : [];
    e.badInput = this.options.html
      ? locateInputs(els).flatMap(({ item, path }) => {
          const kind = badInputKind(item);
          const label = path.length ? labelOf([item]) : null;
          return kind ? [{ el: item as HTMLInputElement, path, kind, label }] : [];
        })
      : [];
    if (e.disabledByCode) for (const el of els) el.disabled = e.disabled;
    else e.disabled = els.length > 0 && els.every((el) => el.matches(':disabled'));
    // Code values are written on first connect; after that the DOM is the source of truth.
    if (e.explicit && !e.attached) {
      writeValue(els, e.value);
      this.readBack(e, els);
    } else {
      e.value = this.read(e, els);
      if (!e.attached) e.initial = e.value;
    }
    e.attached = true;
  }

  private read(e: Entry, els: FormElement[]): FieldValue {
    return freeze(readValue(els, e.def.array || (e.inferred && looksLikeArray(els))));
  }

  /** Re-read bound inputs, for values set without events (autofill, scripts). Returns whether any changed. */
  private pull(): boolean {
    if (!this.root) return false;
    const groups = groupByKey(elementsOf(this.root));
    let changed = false;
    for (const e of this.entries.values()) {
      const els = groups.get(e.name);
      if (!els || !e.attached) continue;
      const value = this.read(e, els);
      if (equal(value, e.value)) continue;
      e.value = value;
      e.explicit = false;
      changed = true;
    }
    return changed;
  }

  private groups(): Map<string, FormElement[]> {
    return this.root ? groupByKey(elementsOf(this.root)) : new Map();
  }

  private elementsFor(name: string): FormElement[] {
    return this.groups().get(name) ?? [];
  }

  private writeDom(e: Entry, groups = this.groups()): void {
    const els = groups.get(e.name) ?? [];
    if (els.length === 0) return;
    writeValue(els, e.value);
    this.readBack(e, els);
  }

  private setTouched(name: string | undefined, touched: boolean): void {
    for (const e of this.entries.values()) {
      if (name !== undefined && e.name !== name) continue;
      e.touched = e.touchedAll = touched;
      e.touchedEls = new WeakSet();
    }
    this.emit();
  }

  private setDisabled(name: string, disabled: boolean): void {
    const e = this.entries.get(name);
    if (!e) return;
    e.disabled = disabled;
    e.disabledByCode = true;
    if (disabled) {
      this.cancelAsync(e);
      e.async = freshAsync(); // re-run when enabled again
    }
    for (const el of this.elementsFor(name)) el.disabled = disabled;
    this.revalidate();
  }

  private allValues(): Values {
    if (!this.valuesCache) {
      this.valuesCache = {};
      for (const e of this.entries.values()) this.valuesCache[e.name] = e.value;
    }
    return this.valuesCache;
  }

  private output(): FormOutput<F> {
    const out: Record<string, unknown> = {};
    for (const e of this.entries.values()) {
      if (!e.disabled) out[e.name] = e.def.schema ? e.schema.output : e.value;
    }
    return out as FormOutput<F>;
  }

  private label(e: Entry): string {
    return e.def.label ?? e.domLabel ?? this.options.fallbackLabel;
  }

  private message(
    e: Entry,
    kind: RuleName,
    params: Readonly<Record<string, unknown>>,
    custom: Message | undefined,
    label: string | null = null,
    value: FieldValue = e.value,
  ): string {
    const ctx = { ...params, label: label ?? this.label(e), name: e.name, value };
    return formatMessage(custom ?? this.options.messages[kind], ctx);
  }

  // internals: validation -------------------------------------------------------------

  /** Re-run sync rules everywhere, (re)start schema and async checks whose value changed, notify. */
  private revalidate(): void {
    this.valuesCache = undefined;
    for (const e of this.entries.values()) {
      e.sync = e.disabled ? [] : this.syncIssues(e);
      if (!e.disabled) this.runSchema(e);
    }
    for (const e of this.entries.values()) this.runAsync(e);
    this.emit();
  }

  private syncIssues(e: Entry): Issue[] {
    const v = e.value;
    // Text the browser rejected (`12e` in a number input) reads as '' — report it instead of "required".
    const bad = e.badInput.filter((b) => b.el.validity?.badInput);
    const issues: Issue[] = bad.map((b) => ({
      message: this.message(e, b.kind, {}, undefined, b.label),
      path: b.path,
    }));
    if (bad.some((b) => b.path.length === 0)) return issues;
    const unreadable = new Set(bad.map((b) => b.path.join('.')));
    // Chained rules always run, also next to a schema; schema fields get no HTML rules (see attach()).
    for (const rule of e.def.rules) this.check(e, rule, v, [], null, issues);
    for (const { path, label, rules } of e.htmlRules) {
      if (unreadable.has(path.join('.'))) continue;
      const sub = path.length ? getPath(v, path) : v;
      for (const rule of rules) this.check(e, rule, sub, path, label, issues);
    }
    const values = this.allValues();
    for (const { target, message } of e.def.sameAs) {
      if (equal(v, values[target] ?? null)) continue;
      const other = this.entries.get(target);
      const targetLabel = other?.def.label ?? other?.domLabel ?? target;
      issues.push({ message: this.message(e, 'sameAs', { target: targetLabel }, message), path: [] });
    }
    for (const rule of e.def.custom) {
      const result = rule(v, { values, name: e.name });
      if (typeof result === 'string' && result) issues.push({ message: result, path: [] });
    }
    return issues;
  }

  /** Apply one rule at `path`; element-wise rules report each failing list entry at its own path. */
  private check(
    e: Entry,
    rule: Rule,
    value: FieldValue,
    path: Path,
    label: string | null,
    out: Issue[],
  ): void {
    const fail = (at: Path, failed: FieldValue) =>
      out.push({ message: this.message(e, rule.kind, rule.params, rule.message, label, failed), path: at });
    if (!rule.each) {
      if (!rule.test(value)) fail(path, value);
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === 'string' && item !== '' && !rule.test(item)) fail([...path, i], item);
      });
    } else if (typeof value === 'string' && value !== '' && !rule.test(value)) {
      fail(path, value);
    }
  }

  private runSchema(e: Entry): void {
    const schema = e.def.schema;
    if (!schema || (e.schema.value !== UNSET && equal(e.schema.value, e.value))) return;
    const run = e.schema;
    const token = ++run.token;
    run.value = e.value;
    const apply = (result: StandardSchemaV1.Result<unknown>) => {
      run.issues = result.issues ? toIssues(result.issues) : [];
      run.output = result.issues ? undefined : result.value;
      run.pending = false;
    };
    let result: ReturnType<StandardSchemaV1['~standard']['validate']>;
    try {
      result = schema['~standard'].validate(e.value);
    } catch (err) {
      result = { issues: [{ message: errorMessage(err) }] };
    }
    if (!isPromise(result)) {
      apply(result);
      return;
    }
    run.pending = true;
    run.issues = [];
    run.promise = Promise.resolve(result).then(
      (r) => {
        if (!this.live(e, run, token)) return; // stale, reset, removed or replaced
        apply(r);
        this.runAsync(e);
        this.emit();
      },
      (err: unknown) => {
        if (!this.live(e, run, token)) return;
        apply({ issues: [{ message: errorMessage(err) }] });
        this.emit();
      },
    );
  }

  private runAsync(e: Entry): void {
    const rules = e.def.async;
    if (rules.length === 0) return;
    const run = e.async;
    if (e.disabled || e.sync.length || e.schema.pending || e.schema.issues.length || isEmpty(e.value)) {
      this.cancelAsync(e);
      run.value = UNSET;
      run.error = null;
      return;
    }
    if (run.value !== UNSET && equal(run.value, e.value)) return; // done, or in flight for this value
    this.cancelAsync(e);
    const token = ++run.token;
    const value = e.value;
    run.value = value;
    run.error = null;
    run.pending = true;

    run.start = () => {
      run.start = undefined;
      const controller = new AbortController();
      run.controller = controller;
      run.promise = (async () => {
        let error: string | null = null;
        for (const { rule } of rules) {
          let result: unknown;
          try {
            result = await rule(value, { values: this.allValues(), name: e.name, signal: controller.signal });
          } catch {
            if (controller.signal.aborted) return;
            result = this.message(e, 'async', {}, undefined);
          }
          if (!this.live(e, run, token)) return; // superseded
          if (typeof result === 'string' && result) {
            error = result;
            break;
          }
        }
        if (!this.live(e, run, token)) return;
        run.error = error;
        run.pending = false;
        run.controller = undefined;
        this.emit();
      })();
    };

    // Without a DOM (SSR) async rules wait for validate(): no requests or timers during render, and
    // the snapshot (pending) matches the one the browser hydrates with.
    if (typeof document === 'undefined') return;
    const debounce = Math.max(...rules.map((r) => r.debounce));
    if (debounce > 0) {
      run.timer = setTimeout(() => {
        run.timer = undefined;
        run.start?.();
      }, debounce);
    } else {
      run.start();
    }
  }

  /** Is this run still the current one, for a control that is still in the form? */
  private live(e: Entry, run: SchemaRun | AsyncRun, token: number): boolean {
    return this.entries.get(e.name) === e && (e.schema === run || e.async === run) && run.token === token;
  }

  /** Abort the async run (timer, request) and release its pending state. */
  private cancelAsync(e: Entry): void {
    const run = e.async;
    run.token++;
    clearTimeout(run.timer);
    run.timer = undefined;
    run.start = undefined;
    run.controller?.abort();
    run.controller = undefined;
    run.pending = false;
  }

  private controlState(e: Entry): ControlState {
    const issues: Issue[] = e.disabled
      ? []
      : [...e.sync, ...e.schema.issues, ...(e.async.error ? [{ message: e.async.error, path: [] }] : [])];
    const pending = !e.disabled && (e.schema.pending || e.async.pending);
    const errors = issues.map((i) => i.message);
    const invalid = !e.disabled && errors.length > 0;
    const dirty = !equal(e.value, e.initial);
    const next: ControlState = {
      name: e.name,
      label: this.label(e),
      value: e.value,
      errors,
      error: errors[0] ?? null,
      issues,
      valid: e.disabled || (errors.length === 0 && !pending),
      invalid,
      pending,
      touched: e.touched,
      untouched: !e.touched,
      dirty,
      pristine: !dirty,
      disabled: e.disabled,
      status: e.disabled ? 'disabled' : pending ? 'pending' : invalid ? 'invalid' : 'valid',
    };
    // Structural sharing: keep the previous snapshot when nothing changed (cheap memoization for UIs).
    const prev = e.snapshot;
    if (
      prev &&
      prev.value === next.value &&
      prev.label === next.label &&
      prev.pending === next.pending &&
      prev.touched === next.touched &&
      prev.dirty === next.dirty &&
      prev.disabled === next.disabled &&
      sameList(prev.issues, next.issues, sameIssue)
    ) {
      return prev;
    }
    e.snapshot = Object.freeze(next);
    return e.snapshot;
  }

  private emit(): void {
    this.state = undefined;
    if (this.root && this.options.aria) this.syncAria(this.root);
    // A listener may change the form; restart delivery so every listener ends on the latest state.
    if (this.emitting) {
      this.emitAgain = true;
      return;
    }
    this.emitting = true;
    try {
      do {
        this.emitAgain = false;
        const state = this.getState();
        if (state === this.delivered) break;
        this.delivered = state;
        for (const listener of this.listeners) {
          listener(state);
          if (this.emitAgain) {
            this.delivered = undefined; // later listeners missed it: deliver the next state to all
            break;
          }
        }
      } while (this.emitAgain);
    } finally {
      this.emitting = false;
    }
  }

  // internals: DOM events -------------------------------------------------------------

  /** Listen on the root, and directly on `form="id"` inputs outside it (never on the document). */
  private listen(target: EventTarget, on: boolean): void {
    const method = on ? 'addEventListener' : 'removeEventListener';
    target[method]('input', this.onInput);
    target[method]('change', this.onInput);
    target[method]('focusout', this.onFocusOut);
    target[method]('pointerdown', this.onPointerDown);
    target[method]('submit', this.onSubmit);
    target[method]('reset', this.onReset);
  }

  /** Is `node` a field of the bound root (inside it, or associated with it via `form="id"`)? */
  private owns(node: unknown): node is FormElement {
    const root = this.root;
    if (!root || !isFormElement(node)) return false;
    return isFormRoot(root) ? node.form === root : root.contains(node);
  }

  private onInput = (event: Event): void => {
    const target = event.target;
    if (!this.owns(target)) return;
    const { key } = parseName(nameOf(target));
    const e = this.entries.get(key);
    if (!e) {
      if (key && this.options.html) this.refresh(); // a new name: refresh() creates and reads it
      return;
    }
    e.value = this.read(e, this.elementsFor(key));
    e.explicit = false;
    this.revalidate();
  };

  /**
   * While a pointer is pressed in the form, leaving an input doesn't reveal its errors until the
   * pointer is released (after the click): otherwise an error appearing on `pointerdown` can shift
   * the button being clicked (Submit) away from the pointer, and the click is lost.
   */
  private onPointerDown = (event: Event): void => {
    if (this.held) return;
    const held: EventTarget[] = [];
    this.held = held;
    const release = () =>
      setTimeout(() => {
        if (this.held === held) this.held = undefined;
        for (const target of held.splice(0)) this.leave(target);
      });
    const doc = (event.target as Node).ownerDocument!;
    doc.addEventListener('pointerup', release, { once: true, capture: true });
    doc.addEventListener('pointercancel', release, { once: true, capture: true });
  };

  private onFocusOut = (event: Event): void => this.leave(event.target);

  private leave(target: EventTarget | null): void {
    if (!this.owns(target)) return;
    if (this.held) {
      this.held.push(target);
      return;
    }
    const { key } = parseName(nameOf(target));
    const e = this.entries.get(key);
    if (!e || (e.touched && e.touchedEls.has(target))) return;
    e.touched = true;
    e.touchedEls.add(target); // per input, so each `emails[]` row shows its errors on its own
    this.emit();
  }

  private onMutations = (records: MutationRecord[]): void => {
    const has = (selector: string) => (n: Node) =>
      n instanceof Element && (n.matches(selector) || n.querySelector(selector) !== null);
    const nodes = records.flatMap((r) => [...r.addedNodes, ...r.removedNodes]);
    if (nodes.some((n) => isFormElement(n) || has('input,select,textarea')(n))) this.refresh();
    // Error slots rendered later (a component re-render) are filled and wired right away.
    else if (this.root && this.options.aria && nodes.some(has('[data-formidate-error]')))
      this.syncAria(this.root);
  };

  /**
   * Native submission gate: block an invalid/pending form, reveal its errors, focus the first problem.
   * When only async checks were pending, submit again once they pass (unless `handleSubmit` took over).
   */
  private onSubmit = (event: Event): void => {
    if (event.defaultPrevented) return;
    if (this.pull()) this.revalidate();
    const state = this.getState();
    if (state.valid) return;
    event.preventDefault();
    this.setTouched(undefined, true);
    if (state.invalid) {
      if (this.options.focusOnError) this.focusFirstInvalid();
      return;
    }
    const form = event.target as HTMLFormElement;
    const by = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    const count = this.submitCount;
    const run = ++this.gateRun;
    void this.validate().then((valid) => {
      if (valid && run === this.gateRun && count === this.submitCount && this.root?.contains(form))
        form.requestSubmit(by?.form === form ? by : undefined);
    });
  };

  /** `reset` fires before the browser restores the inputs, so sync afterwards (unless cancelled). */
  private onReset = (event: Event): void => {
    clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => {
      if (!event.defaultPrevented) this.reset();
    }, 0);
  };

  /** Focus the first input with a visible error (`aria-invalid`), else the first input of an invalid control. */
  private focusFirstInvalid(): void {
    if (!this.root) return;
    const controls = this.getState().controls as Record<string, ControlState | undefined>;
    const all = elementsOf(this.root).filter((el) => !el.disabled);
    (
      all.find((el) => this.ariaInvalid.has(el)) ??
      all.find((el) => controls[parseName(nameOf(el)).key]?.invalid)
    )?.focus();
  }

  /** Should errors of `e` at `path` be visible (to an input, or to a slot that also covers sub-paths)? */
  private shows(e: Entry | undefined, path: Path, touched: readonly string[] = []): boolean {
    if (!e || e.disabled || !e.touched) return false;
    if (e.touchedAll || path.length === 0) return true;
    const id = path.join('.');
    return touched.some((t) => t === id || t.startsWith(`${id}.`) || id.startsWith(`${t}.`));
  }

  /** Mirror visible errors into the DOM: `aria-invalid`, error slots, `aria-describedby`. */
  private syncAria(root: Element): void {
    const { controls } = this.getState();
    const issuesOf = (key: string) =>
      (controls as Record<string, ControlState | undefined>)[key]?.issues ?? [];
    const inputs = new Map<string, Located<FormElement>[]>();
    const touched = new Map<string, string[]>(); // key → ids of the touched input paths
    for (const [key, els] of groupByKey(elementsOf(root))) {
      const located = locateInputs(els);
      inputs.set(key, located);
      const e = this.entries.get(key);
      if (e?.touched)
        touched.set(
          key,
          located.filter((l) => e.touchedEls.has(l.item)).map((l) => l.path.join('.')),
        );
    }
    const present = new Set<Element>();

    for (const [key, located] of inputs) {
      const e = this.entries.get(key);
      for (const { item: el, path } of located) {
        present.add(el);
        const invalid =
          this.shows(e, path, touched.get(key)) && issuesOf(key).some((i) => issueTouchesInput(i, path));
        if (invalid) {
          el.setAttribute('aria-invalid', 'true');
          this.ariaInvalid.add(el);
        } else if (this.ariaInvalid.delete(el)) {
          el.removeAttribute('aria-invalid');
        }
      }
    }

    // Each issue goes to the most specific slot covering its path: `guests` shows list errors,
    // `guests[0][email]` that row's. A slot shows the first issue routed to it.
    const slots = locateSlots(Array.from(root.querySelectorAll<HTMLElement>('[data-formidate-error]')));
    // Slots that left (re-rendered, swapped): drop their ids from the inputs they described.
    const live = new Set(slots.map((s) => s.item));
    const liveIds = new Set(slots.map((s) => s.item.id));
    for (const slot of this.slots.keys()) {
      if (live.has(slot)) continue;
      this.slots.delete(slot);
      if (liveIds.has(slot.id)) continue;
      for (const [el, ids] of this.describedBy)
        if (ids.delete(slot.id)) removeToken(el, 'aria-describedby', slot.id);
    }
    const routed = new Map<HTMLElement, string>();
    for (const key of new Set(slots.map((s) => s.key))) {
      const own = slots.filter((s) => s.key === key);
      const e = this.entries.get(key);
      // Only errors of inputs the user has left (or all, after a submit), also in a container slot.
      for (const issue of issuesOf(key).filter((i) => this.shows(e, i.path, touched.get(key)))) {
        let found: (typeof slots)[number] | undefined;
        for (const s of own) {
          if (startsWith(issue.path, s.path) && (!found || s.path.length > found.path.length)) found = s;
        }
        if (found && !routed.has(found.item)) routed.set(found.item, issue.message);
      }
    }

    for (const { item: el, key, path } of slots) {
      present.add(el);
      const message = routed.get(el) ?? '';
      if (!this.slots.has(el))
        this.slots.set(el, { text: el.textContent ?? '', hidden: el.hidden, id: el.id });
      if (el.textContent !== message) el.textContent = message;
      // A live region must stay in the accessibility tree to be announced, so it is never hidden.
      if (!el.hasAttribute('aria-live') && !el.hasAttribute('role')) el.hidden = message === '';
      // Generated ids skip ones already in the page (e.g. a second copy of Formidate counting from 1).
      while (!el.id) {
        const id = `formidate-error-${++errorIds}`;
        if (!el.ownerDocument.getElementById(id)) el.id = id;
      }
      // Describe the inputs this slot speaks for: its path and everything under it.
      for (const input of inputs.get(key) ?? []) {
        if (!startsWith(input.path, path)) continue;
        if (addToken(input.item, 'aria-describedby', el.id)) {
          const ids = this.describedBy.get(input.item) ?? new Set<string>();
          this.describedBy.set(input.item, ids.add(el.id));
        }
      }
    }

    // Forget inputs and slots that left the form (dynamic rows), so they can be collected.
    for (const el of this.ariaInvalid) if (!present.has(el)) this.ariaInvalid.delete(el);
    for (const el of this.describedBy.keys()) if (!present.has(el)) this.describedBy.delete(el);
  }
}

/**
 * Create a form. Without fields, every named input becomes a control when you `bind()` it, validated
 * by its HTML attributes.
 *
 * @example
 * const form = createForm({ email: field().required().email() });
 * form.bind('#signup');
 */
export function createForm<F extends FieldsMap = DynamicFields>(fields?: F, options?: FormOptions): Form<F> {
  return new Form<F>(fields, options);
}
