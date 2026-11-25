import * as v from 'valibot';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod';
import { configure, DEFAULT_MESSAGES } from './config';
import { field } from './field';
import { createForm, Form } from './form';
import type { StandardSchemaV1 } from './standard-schema';
import type { ControlState, FieldValue, FormState } from './types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A hand-rolled async Standard Schema whose results the test resolves manually. */
function manualSchema() {
  const calls: { value: unknown; done: ReturnType<typeof deferred<StandardSchemaV1.Result<unknown>>> }[] = [];
  const schema: StandardSchemaV1 = {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: (value) => {
        const done = deferred<StandardSchemaV1.Result<unknown>>();
        calls.push({ value, done });
        return done.promise;
      },
    },
  };
  return { schema, calls };
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

afterEach(() => {
  vi.useRealTimers();
});

describe('createForm', () => {
  it('returns a Form with the declared controls, validated on creation', () => {
    const form = createForm({ a: field().required(), b: field('x') });
    expect(form).toBeInstanceOf(Form);
    expect(Object.keys(form.controls)).toEqual(['a', 'b']);
    expect(form.controls.a.errors).toEqual(['This field is required']);
    expect(form.valid).toBe(false);
    expect(form.invalid).toBe(true);
  });

  it('a form without fields is valid', () => {
    const form = createForm();
    expect(form.valid).toBe(true);
    expect(form.values).toEqual({});
  });

  it('accepts a raw Standard Schema in place of a Field', () => {
    const form = createForm({ email: z.email('Bad email') });
    form.setValue('email', 'nope');
    expect(form.controls.email.errors).toEqual(['Bad email']);
  });
});

describe('state snapshots', () => {
  it('returns the same reference until something changes', () => {
    const form = createForm({ a: field(), b: field() });
    const s1 = form.getState();
    expect(form.getState()).toBe(s1);
    form.setValue('a', 'x');
    const s2 = form.getState();
    expect(s2).not.toBe(s1);
    expect(s2.controls.b).toBe(s1.controls.b); // structural sharing
    expect(s2.controls.a).not.toBe(s1.controls.a);
  });

  it('is frozen', () => {
    const s = createForm({ a: field() }).getState();
    expect(Object.isFrozen(s)).toBe(true);
    expect(Object.isFrozen(s.controls)).toBe(true);
    expect(Object.isFrozen(s.values)).toBe(true);
    expect(Object.isFrozen(s.controls.a)).toBe(true);
  });

  it('exposes control state fields', () => {
    const form = createForm({ a: field().label('A').required() });
    expect(form.controls.a).toMatchObject({
      name: 'a',
      label: 'A',
      value: null,
      errors: ['A is required'],
      error: 'A is required',
      valid: false,
      invalid: true,
      pending: false,
      touched: false,
      untouched: true,
      dirty: false,
      pristine: true,
      disabled: false,
      status: 'invalid',
    });
    form.setValue('a', 'ok');
    expect(form.controls.a).toMatchObject({ error: null, valid: true, status: 'valid', dirty: true });
  });

  it('exposes form-level getters', () => {
    const form = createForm({ a: field() });
    expect(form.pending).toBe(false);
    expect(form.dirty).toBe(false);
    expect(form.touched).toBe(false);
    form.setValue('a', 'x');
    form.touch('a');
    expect(form.dirty).toBe(true);
    expect(form.touched).toBe(true);
  });
});

describe('subscribe', () => {
  it('calls the listener immediately and after each change, until unsubscribed', () => {
    const form = createForm({ a: field() });
    const seen: FormState[] = [];
    const stop = form.subscribe((s) => seen.push(s));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(form.getState());
    form.setValue('a', 'x');
    expect(seen.length).toBeGreaterThan(1);
    expect(seen.at(-1)!.values.a).toBe('x');
    const count = seen.length;
    stop();
    form.setValue('a', 'y');
    expect(seen).toHaveLength(count);
  });
});

describe('values', () => {
  it('setValue normalizes blank strings to null and numbers/booleans to strings', () => {
    const form = createForm({ a: field(), b: field(), c: field(), d: field() });
    form.setValues({ a: '  ', b: 5 as never, c: true as never, d: undefined as never });
    expect(form.values).toEqual({ a: null, b: '5', c: 'true', d: null });
  });

  it('setValues ignores unknown names', () => {
    const form = createForm({ a: field() });
    form.setValues({ nope: 'x' } as never);
    expect(form.values).toEqual({ a: null });
  });

  it('keeps arrays and objects as given', () => {
    const form = createForm({ tags: field().array(), obj: field() });
    form.setValues({ tags: ['a'], obj: { x: 'y' } as never });
    expect(form.values.tags).toEqual(['a']);
    expect(form.values.obj).toEqual({ x: 'y' });
  });

  it('dirty means the value differs from the initial value', () => {
    const form = createForm({ a: field('x'), tags: field().array(['a']) });
    form.setValue('a', 'y');
    expect(form.controls.a.dirty).toBe(true);
    form.setValue('a', 'x');
    expect(form.controls.a.dirty).toBe(false);
    form.setValue('tags', ['a']);
    expect(form.controls.tags.dirty).toBe(false);
    form.setValue('tags', ['a', 'b']);
    expect(form.controls.tags.dirty).toBe(true);
  });
});

describe('touch / untouch', () => {
  it('touches one or all controls', () => {
    const form = createForm({ a: field(), b: field() });
    form.touch('a');
    expect(form.controls.a.touched).toBe(true);
    expect(form.controls.b.touched).toBe(false);
    form.touch();
    expect(form.controls.b.touched).toBe(true);
    form.untouch('a');
    expect(form.controls.a.touched).toBe(false);
    form.untouch();
    expect(form.controls.b.touched).toBe(false);
  });
});

describe('disable / enable', () => {
  it('disabled controls have no errors and do not affect validity or output', async () => {
    const form = createForm({ a: field().required(), b: field('ok') });
    form.disable('a');
    expect(form.controls.a).toMatchObject({
      disabled: true,
      valid: true,
      invalid: false,
      errors: [],
      status: 'disabled',
    });
    expect(form.valid).toBe(true);
    const onValid = vi.fn();
    await form.handleSubmit(onValid)();
    expect(onValid).toHaveBeenCalledWith({ b: 'ok' }, undefined);
    form.enable('a');
    expect(form.controls.a.errors).toEqual(['This field is required']);
    expect(form.valid).toBe(false);
  });

  it('ignores unknown names', () => {
    const form = createForm({ a: field() });
    expect(() => form.disable('nope' as never)).not.toThrow();
  });

  it('disabling cancels a running async rule', async () => {
    let signal: AbortSignal | undefined;
    const form = createForm({
      u: field().async((_v, ctx) => {
        signal = ctx.signal;
        return new Promise(() => {});
      }),
    });
    form.setValue('u', 'bob');
    expect(form.controls.u.pending).toBe(true);
    form.disable('u');
    expect(signal?.aborted).toBe(true);
    expect(form.pending).toBe(false);
    await expect(form.validate()).resolves.toBe(true);
  });
});

describe('addFields / removeFields', () => {
  it('adds controls and returns a typed form', () => {
    const form = createForm({ a: field() });
    const more = form.addFields({ b: field().required() });
    expect(more).toBe(form);
    expect(more.controls.b.errors).toEqual(['This field is required']);
    expectTypeOf(more.values.b).toEqualTypeOf<string | null>();
  });

  it('re-adding a name replaces the control', () => {
    const form = createForm({ a: field().required() });
    form.addFields({ a: field() });
    expect(form.controls.a.errors).toEqual([]);
  });

  it('removes controls', () => {
    const form = createForm({ a: field().required(), b: field() });
    form.removeFields('a', 'nope' as never);
    expect(Object.keys(form.controls)).toEqual(['b']);
    expect(form.valid).toBe(true);
  });
});

describe('reset', () => {
  it('restores initial values and clears touched, dirty and submitCount', async () => {
    const form = createForm({ a: field('x').required() });
    form.setValue('a', 'y');
    await form.handleSubmit(() => {})();
    expect(form.getState().submitCount).toBe(1);
    form.reset();
    expect(form.getState()).toMatchObject({
      values: { a: 'x' },
      dirty: false,
      touched: false,
      submitCount: 0,
    });
  });

  it('reset(values) replaces the initial values', () => {
    const form = createForm({ a: field('x'), b: field('b') });
    form.reset({ a: 'new' });
    expect(form.values).toEqual({ a: 'new', b: 'b' });
    form.setValue('a', 'changed');
    form.reset();
    expect(form.values.a).toBe('new');
    expect(form.controls.a.dirty).toBe(false);
  });

  it('aborts running async rules', () => {
    let signal: AbortSignal | undefined;
    const form = createForm({
      u: field().async((_v, ctx) => {
        signal = ctx.signal;
        return new Promise(() => {});
      }),
    });
    form.setValue('u', 'x');
    form.reset();
    expect(signal?.aborted).toBe(true);
    expect(form.pending).toBe(false);
  });
});

describe('cross-field and custom rules', () => {
  it('sameAs compares against another control and uses its label', () => {
    const form = createForm({
      pw: field().label('Password'),
      confirm: field().label('Confirm').sameAs('pw'),
    });
    form.setValues({ pw: 'a', confirm: 'b' });
    expect(form.controls.confirm.errors).toEqual(['Confirm must match Password']);
    form.setValue('confirm', 'a');
    expect(form.controls.confirm.errors).toEqual([]);
    form.setValue('pw', 'z'); // changing the target re-validates the dependant
    expect(form.controls.confirm.valid).toBe(false);
  });

  it('sameAs falls back to the target name when the target does not exist', () => {
    const form = createForm({ confirm: field().sameAs('missing', '{target}!') });
    form.setValue('confirm', 'a');
    expect(form.controls.confirm.errors).toEqual(['missing!']);
  });

  it('custom rules run on empty values and receive values + name', () => {
    const rule = vi.fn((value: string | null, ctx: { values: Record<string, FieldValue>; name: string }) =>
      ctx.values.other && !value ? 'needed when other is set' : null,
    );
    const form = createForm({ other: field(), x: field().custom(rule) });
    expect(rule).toHaveBeenCalledWith(null, expect.objectContaining({ name: 'x' }));
    form.setValue('other', 'y');
    expect(form.controls.x.errors).toEqual(['needed when other is set']);
  });

  it('custom rules stack; non-string results pass', () => {
    const form = createForm({
      x: field()
        .custom(() => 'one')
        .custom(() => '')
        .custom(() => undefined)
        .custom(() => 'two'),
    });
    expect(form.controls.x.errors).toEqual(['one', 'two']);
  });
});

describe('async rules', () => {
  it('runs after sync rules pass and reports the first error', async () => {
    const second = vi.fn(async () => 'second');
    const form = createForm({
      u: field()
        .minLength(3)
        .async(async (value) => (value === 'taken' ? 'Already taken' : null))
        .async(second),
    });
    form.setValue('u', 'taken');
    expect(form.controls.u).toMatchObject({ pending: true, status: 'pending', valid: false, invalid: false });
    expect(form.valid).toBe(false);
    await form.validate();
    expect(form.controls.u.errors).toEqual(['Already taken']);
    expect(second).not.toHaveBeenCalled();
    form.setValue('u', 'free');
    await form.validate();
    expect(form.controls.u.errors).toEqual(['second']);
  });

  it('is skipped when sync rules fail or the value is empty', async () => {
    const rule = vi.fn(async () => null);
    const form = createForm({ u: field().minLength(3).async(rule) });
    form.setValue('u', 'ab');
    form.setValue('u', null);
    await form.validate();
    expect(rule).not.toHaveBeenCalled();
    expect(form.controls.u.pending).toBe(false);
  });

  it('does not re-run for an unchanged value', async () => {
    const rule = vi.fn(async () => null);
    const form = createForm({ u: field().async(rule), other: field() });
    form.setValue('u', 'bob');
    await form.validate();
    form.setValue('other', 'x');
    await form.validate();
    expect(rule).toHaveBeenCalledTimes(1);
  });

  it('passes the form values, name and an AbortSignal that aborts when superseded', async () => {
    const signals: AbortSignal[] = [];
    const form = createForm({
      u: field().async((_v, ctx) => {
        expect(ctx.name).toBe('u');
        expect(ctx.values).toHaveProperty('u');
        signals.push(ctx.signal);
        return null;
      }),
    });
    form.setValue('u', 'a');
    form.setValue('u', 'b');
    await form.validate();
    expect(signals).toHaveLength(2);
    expect(signals[0]!.aborted).toBe(true);
    expect(signals[1]!.aborted).toBe(false);
  });

  it('discards stale results', async () => {
    const pending: Record<string, ReturnType<typeof deferred<string | null>>> = {};
    const form = createForm({
      u: field().async((value) => {
        pending[value as string] = deferred<string | null>();
        return pending[value as string]!.promise;
      }),
    });
    form.setValue('u', 'old');
    form.setValue('u', 'new');
    pending.new!.resolve(null);
    await flush();
    pending.old!.resolve('stale error');
    await flush();
    expect(form.controls.u.errors).toEqual([]);
    expect(form.valid).toBe(true);
  });

  it('a thrown error becomes the "async" message', async () => {
    const form = createForm({
      u: field()
        .label('Username')
        .async(async () => {
          throw new Error('network down');
        }),
    });
    form.setValue('u', 'x');
    await form.validate();
    expect(form.controls.u.errors).toEqual(['Username could not be verified']);
  });

  it('accepts sync return values', async () => {
    const form = createForm({ u: field().async(() => 'nope') });
    form.setValue('u', 'x');
    await form.validate();
    expect(form.controls.u.errors).toEqual(['nope']);
  });

  it('debounces and counts the debounce as pending', async () => {
    vi.useFakeTimers();
    const rule = vi.fn(async () => null);
    const form = createForm({ u: field().async(rule, { debounce: 300 }) });
    form.setValue('u', 'a');
    form.setValue('u', 'ab');
    expect(form.controls.u.pending).toBe(true);
    vi.advanceTimersByTime(299);
    expect(rule).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(rule).toHaveBeenCalledTimes(1);
    expect(rule).toHaveBeenCalledWith('ab', expect.anything());
    await flush();
    expect(form.controls.u.pending).toBe(false);
  });

  it('validate() flushes debounced rules', async () => {
    vi.useFakeTimers();
    const rule = vi.fn(async () => 'bad');
    const form = createForm({ u: field().async(rule, { debounce: 10_000 }) });
    form.setValue('u', 'x');
    await expect(form.validate()).resolves.toBe(false);
    expect(rule).toHaveBeenCalledTimes(1);
    expect(form.controls.u.errors).toEqual(['bad']);
  });
});

describe('Standard Schema', () => {
  it('Zod: sync schema issues become errors', () => {
    const form = createForm({ name: z.string().min(3, 'Too short') });
    form.setValue('name', 'ab');
    expect(form.controls.name.errors).toEqual(['Too short']);
    form.setValue('name', 'abc');
    expect(form.controls.name.valid).toBe(true);
  });

  it('Zod: empty inputs arrive as null', () => {
    const form = createForm({ name: z.string().nullable(), req: z.string('Required') });
    expect(form.controls.name.valid).toBe(true);
    expect(form.controls.req.errors).toEqual(['Required']);
  });

  it('Zod: async refinements mark the control pending', async () => {
    const form = createForm({
      u: z.string().refine(async (s) => s !== 'taken', 'Taken'),
    });
    form.setValue('u', 'taken');
    expect(form.controls.u.pending).toBe(true);
    await expect(form.validate()).resolves.toBe(false);
    expect(form.controls.u.errors).toEqual(['Taken']);
  });

  it('Zod: object issues keep their path', () => {
    const form = createForm({
      address: z.object({ zip: z.string().regex(/^\d{5}$/, 'Bad ZIP'), city: z.string() }),
    });
    form.setValue('address', { zip: '1', city: 'X' });
    expect(form.controls.address.issues).toEqual([{ message: 'Bad ZIP', path: ['zip'] }]);
  });

  it('Valibot: sync and async schemas work', async () => {
    const form = createForm({
      email: v.pipe(v.string(), v.email('Bad email')),
      u: v.pipeAsync(
        v.string(),
        v.checkAsync(async (s) => s !== 'taken', 'Taken'),
      ),
    });
    form.setValues({ email: 'nope', u: 'taken' });
    expect(form.controls.email.errors).toEqual(['Bad email']);
    await form.validate();
    expect(form.controls.u.errors).toEqual(['Taken']);
  });

  it('submits the schema output (coercion / transforms)', async () => {
    const form = createForm({
      age: z.coerce.number().min(18),
      name: field().required(),
      tag: field().schema(z.string().transform((s) => s.toUpperCase())),
    });
    form.setValues({ age: '42', name: 'Ann', tag: 'abc' });
    const onValid = vi.fn();
    await form.handleSubmit(onValid)();
    expect(onValid).toHaveBeenCalledWith({ age: 42, name: 'Ann', tag: 'ABC' }, undefined);
  });

  it('field().schema() also runs chained built-in rules, custom and sameAs', () => {
    const form = createForm({
      a: field(),
      x: field()
        .required()
        .schema(z.string().nullable())
        .custom((v) => (v === 'no' ? 'custom says no' : null))
        .sameAs('a'),
    });
    // schema accepts null, but the chained required() keeps the `string` output type truthful
    expect(form.controls.x.errors).toEqual(['This field is required']);
    form.setValue('x', 'no');
    expect(form.controls.x.errors).toEqual(['This field must match a', 'custom says no']);
  });

  it('sameAs uses the target name when the target has no label', () => {
    const form = createForm({ password: field(), confirm: field().sameAs('password') });
    form.setValues({ password: 'a', confirm: 'b' });
    expect(form.controls.confirm.errors).toEqual(['This field must match password']);
  });

  it('async rules run after the schema passes', async () => {
    const rule = vi.fn(async () => 'async failed');
    const form = createForm({ x: field().schema(z.string().min(3)).async(rule) });
    form.setValue('x', 'ab');
    await form.validate();
    expect(rule).not.toHaveBeenCalled();
    form.setValue('x', 'abc');
    await form.validate();
    expect(form.controls.x.errors).toEqual(['async failed']);
  });

  it('async rules wait for an async schema', async () => {
    const { schema, calls } = manualSchema();
    const rule = vi.fn(async () => null);
    const form = createForm({ x: field().schema(schema).async(rule) });
    form.setValue('x', 'v');
    expect(rule).not.toHaveBeenCalled();
    calls.at(-1)!.done.resolve({ value: 'v' });
    await form.validate();
    expect(rule).toHaveBeenCalledTimes(1);
  });

  it('discards stale async schema results', async () => {
    const { schema, calls } = manualSchema();
    const form = createForm({ a: schema });
    form.setValue('a', 'bad');
    form.setValue('a', 'good');
    const [, slow, fast] = calls; // [initial null, 'bad', 'good']
    fast!.done.resolve({ value: 'good' });
    await flush();
    slow!.done.resolve({ issues: [{ message: 'bad' }] });
    await flush();
    expect(form.values.a).toBe('good');
    expect(form.controls.a.errors).toEqual([]);
  });

  it('a throwing or rejecting schema becomes an error', async () => {
    const throwing: StandardSchemaV1 = {
      '~standard': {
        version: 1,
        vendor: 't',
        validate: () => {
          throw new Error('boom');
        },
      },
    };
    const rejecting: StandardSchemaV1 = {
      '~standard': { version: 1, vendor: 't', validate: () => Promise.reject(new Error('later')) },
    };
    const form = createForm({ a: throwing, b: rejecting });
    await form.validate();
    expect(form.controls.a.errors).toEqual(['boom']);
    expect(form.controls.b.errors).toEqual(['later']);
  });

  it('normalizes symbol and PathSegment keys', () => {
    const schema: StandardSchemaV1 = {
      '~standard': {
        version: 1,
        vendor: 't',
        validate: () => ({ issues: [{ message: 'm', path: [{ key: 'a' }, 0, Symbol.for('s')] }] }),
      },
    };
    const form = createForm({ x: schema });
    expect(form.controls.x.issues).toEqual([{ message: 'm', path: ['a', 0, 'Symbol(s)'] }]);
  });
});

describe('handleSubmit', () => {
  it('prevents default, touches all, increments submitCount and passes output', async () => {
    const form = createForm({ a: field('x'), b: field() });
    const event = { preventDefault: vi.fn() };
    const onValid = vi.fn();
    await form.handleSubmit(onValid)(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onValid).toHaveBeenCalledWith({ a: 'x', b: null }, event);
    expect(form.controls.b.touched).toBe(true);
    expect(form.getState().submitCount).toBe(1);
  });

  it('waits for pending async validation before deciding', async () => {
    const form = createForm({ u: field('bob').async(async () => null) });
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    await form.handleSubmit(onValid, onInvalid)();
    expect(onValid).toHaveBeenCalled();
    expect(onInvalid).not.toHaveBeenCalled();
  });

  it('calls onInvalid with the state when invalid', async () => {
    const form = createForm({ a: field().required() });
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    await form.handleSubmit(onValid, onInvalid)();
    expect(onValid).not.toHaveBeenCalled();
    const state = onInvalid.mock.calls[0]![0] as FormState;
    expect(state.controls.a).toMatchObject({ touched: true, errors: ['This field is required'] });
  });

  it('ignores re-entry while submitting and exposes submitting', async () => {
    const form = createForm({ a: field() });
    const gate = deferred<void>();
    const onValid = vi.fn(() => gate.promise);
    const submit = form.handleSubmit(onValid);
    const first = submit();
    await flush();
    expect(form.getState().submitting).toBe(true);
    await submit();
    expect(onValid).toHaveBeenCalledTimes(1);
    gate.resolve();
    await first;
    expect(form.getState().submitting).toBe(false);
    expect(form.getState().submitCount).toBe(1);
  });

  it('propagates handler errors and resets submitting', async () => {
    const form = createForm({ a: field() });
    await expect(
      form.handleSubmit(() => {
        throw new Error('save failed');
      })(),
    ).rejects.toThrow('save failed');
    expect(form.getState().submitting).toBe(false);
    const invalid = createForm({ a: field().required() });
    await expect(
      invalid.handleSubmit(
        () => {},
        async () => {
          throw new Error('invalid handler');
        },
      )(),
    ).rejects.toThrow('invalid handler');
    expect(invalid.getState().submitting).toBe(false);
  });

  it('is a stable property usable unbound', async () => {
    const form = createForm({ a: field() });
    const { handleSubmit } = form;
    const onValid = vi.fn();
    await handleSubmit(onValid)();
    expect(onValid).toHaveBeenCalled();
  });
});

describe('configure and options', () => {
  afterEach(() => {
    configure({ messages: DEFAULT_MESSAGES, fallbackLabel: undefined, html: undefined, aria: undefined });
  });

  it('global messages apply to new forms; per-form messages win', () => {
    configure({ messages: { required: '{label} est obligatoire' } });
    expect(createForm({ a: field().required() }).controls.a.errors).toEqual(['This field est obligatoire']);
    const local = createForm({ a: field().required() }, { messages: { required: 'local' } });
    expect(local.controls.a.errors).toEqual(['local']);
    expect(createForm({ a: field().required('rule') }).controls.a.errors).toEqual(['rule']);
  });

  it('configure merges messages across calls', () => {
    configure({ messages: { required: 'R' } });
    configure({ messages: { email: 'E' } });
    const form = createForm({ a: field().required(), b: field().email() });
    form.setValue('b', 'x');
    expect(form.controls.a.errors).toEqual(['R']);
    expect(form.controls.b.errors).toEqual(['E']);
  });

  it('fallbackLabel globally and per form', () => {
    configure({ fallbackLabel: 'Ce champ' });
    expect(createForm({ a: field().required() }).controls.a.errors).toEqual(['Ce champ is required']);
    expect(createForm({ a: field().required() }, { fallbackLabel: 'It' }).controls.a.label).toBe('It');
  });

  it('message functions receive the context', () => {
    const form = createForm(
      { a: field().minLength(3) },
      { messages: { minLength: (ctx) => `${ctx.name} needs ${String(ctx.min)}` } },
    );
    form.setValue('a', 'x');
    expect(form.controls.a.errors).toEqual(['a needs 3']);
  });
});

describe('types', () => {
  it('infers values, output and controls', () => {
    const form = createForm({
      email: field().required().email(),
      nick: field(),
      tags: field().array(),
      age: z.coerce.number(),
      role: field().required().oneOf(['admin', 'user']),
    });
    expectTypeOf(form.values.email).toEqualTypeOf<string | null>();
    expectTypeOf(form.values.tags).toEqualTypeOf<string[]>();
    expectTypeOf(form.values.age).toEqualTypeOf<FieldValue>();
    expectTypeOf(form.controls.email.value).toEqualTypeOf<string | null>();
    form.handleSubmit((out) => {
      expectTypeOf(out.email).toEqualTypeOf<string>();
      expectTypeOf(out.nick).toEqualTypeOf<string | null>();
      expectTypeOf(out.tags).toEqualTypeOf<string[]>();
      expectTypeOf(out.age).toEqualTypeOf<number>();
      expectTypeOf(out.role).toEqualTypeOf<'admin' | 'user'>();
    });
    // @ts-expect-error unknown control name
    form.setValue('nope', 'x');
  });

  it('a form without fields is dynamic', () => {
    const form = createForm();
    // Controls only exist once bind() reads the inputs, so the types say they may be missing.
    expectTypeOf(form.values).toEqualTypeOf<Partial<Record<string, FieldValue>>>();
    expectTypeOf(form.controls.email).toEqualTypeOf<ControlState<FieldValue> | undefined>();
  });
});

describe('booleans from code', () => {
  it('setValue(false) clears and setValue(true) ticks a lone checkbox (value becomes the box value)', () => {
    const host = document.createElement('div');
    host.innerHTML = '<form><input type="checkbox" name="agree"></form>';
    document.body.append(host);
    const form = createForm({ agree: field().required() });
    form.bind(host.querySelector('form')!);
    const box = host.querySelector('input')!;
    form.setValue('agree', true as never);
    expect(box.checked).toBe(true);
    expect(form.values.agree).toBe('on');
    expect(form.valid).toBe(true);
    form.setValue('agree', false as never);
    expect(box.checked).toBe(false);
    expect(form.values.agree).toBeNull();
    expect(form.controls.agree.errors).toEqual(['This field is required']);
    host.remove();
  });

  it('without inputs, false is empty and true is "true"', () => {
    const form = createForm({ a: field().required() });
    form.setValue('a', false as never);
    expect(form.controls.a.errors).toEqual(['This field is required']);
    form.setValue('a', true as never);
    expect(form.values.a).toBe('true');
  });
});
