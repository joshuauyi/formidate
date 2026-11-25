// Regression tests for defects found in the independent v2 review.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createForm, field } from './index';
import type { StandardSchemaV1 } from './standard-schema';

function mount(html: string): HTMLFormElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  return host.querySelector('form')!;
}
const type = (el: HTMLInputElement, value: string) => {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('review regressions', () => {
  it('ignores input names that would pollute prototypes', () => {
    const form = mount(
      '<form><input name="x.__proto__.polluted" value="yes"><input name="__proto__" value="a"><input name="constructor.prototype.p" value="b"></form>',
    );
    const f = createForm();
    f.bind(form);
    type(form.querySelector('input')!, 'again');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).p).toBeUndefined();
    expect(Object.keys(f.controls)).toEqual([]);
  });

  it('does not reset when the native reset event is cancelled', () => {
    vi.useFakeTimers();
    const form = mount('<form><input name="a" value="init"></form>');
    const f = createForm();
    f.bind(form);
    type(form.querySelector('input')!, 'typed');
    form.addEventListener('reset', (e) => e.preventDefault());
    form.dispatchEvent(new Event('reset', { cancelable: true }));
    vi.runAllTimers();
    expect(f.values.a).toBe('typed');
  });

  it('delivers the latest state to every listener when a listener changes the form', () => {
    const f = createForm({ a: field(), b: field() });
    f.subscribe((s) => {
      if (s.values.a === 'go' && s.values.b === null) f.setValue('b', 'x');
    });
    const seen: unknown[] = [];
    f.subscribe((s) => seen.push(s.values.b));
    f.setValue('a', 'go');
    expect(seen.at(-1)).toBe('x');
    expect(f.getState().values.b).toBe('x');
  });

  it('does not run async rules for a field removed while its async schema was pending', async () => {
    let resolve!: (r: StandardSchemaV1.Result<unknown>) => void;
    const schema: StandardSchemaV1 = {
      '~standard': { version: 1, vendor: 't', validate: () => new Promise((r) => (resolve = r)) },
    };
    const rule = vi.fn(async () => null);
    const f = createForm({ a: field('v').schema(schema).async(rule) });
    f.removeFields('a');
    resolve({ value: 'v' });
    await Promise.resolve();
    await Promise.resolve();
    expect(rule).not.toHaveBeenCalled();
  });

  it('mirrors disable()/enable() called before bind into the DOM', () => {
    const form = mount('<form><input name="a"><input name="b" disabled></form>');
    const f = createForm({ a: field(), b: field() });
    f.disable('a');
    f.enable('b');
    f.bind(form);
    const [a, b] = Array.from(form.querySelectorAll('input'));
    expect(a!.disabled).toBe(true);
    expect(b!.disabled).toBe(false);
    expect(f.controls.b.disabled).toBe(false);
  });

  it('restores error slots on unbind', () => {
    const form = mount('<form><input name="a" required><p data-formidate-error="a">server</p></form>');
    const f = createForm();
    const unbind = f.bind(form);
    f.touch();
    const slot = form.querySelector('p')!;
    expect(slot.textContent).toBe('This field is required');
    unbind();
    expect(slot.textContent).toBe('server');
    expect(slot.hidden).toBe(false);
    expect(slot.hasAttribute('id')).toBe(false);
  });

  it('ignores invalid pattern attributes like browsers do', () => {
    const form = mount('<form><input name="a" pattern="a)|(b"></form>');
    const f = createForm();
    f.bind(form);
    type(form.querySelector('input')!, 'axxxx');
    expect(f.controls.a!.errors).toEqual([]);
  });

  it('keeps anchored pattern semantics for valid patterns', () => {
    const form = mount('<form><input name="a" pattern="a|b"></form>');
    const f = createForm();
    f.bind(form);
    type(form.querySelector('input')!, 'ab');
    expect(f.controls.a!.errors).toEqual(['This field is not in the expected format']);
  });

  it('deep-freezes structured values so snapshots cannot be mutated', () => {
    const f = createForm({ t: field().array(['a']) });
    expect(() => (f.values.t as string[]).push('b')).toThrow(TypeError);
    const input = ['x'];
    f.setValue('t', input);
    input.push('y');
    expect(f.values.t).toEqual(['x']);
  });

  it('ignores inputs inside the form that belong to another form via form="id"', () => {
    const form = mount(
      '<form id="f1"><input name="mine"><input name="theirs" form="f2"></form><form id="f2"></form>',
    );
    const f = createForm();
    f.bind(form);
    type(form.querySelectorAll('input')[1]!, 'x');
    expect(Object.keys(f.controls)).toEqual(['mine']);
  });
});
