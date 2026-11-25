import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { field } from './field';
import { createForm } from './form';

function mount<T extends Element = HTMLFormElement>(html: string): T {
  const host = document.createElement('div');
  host.innerHTML = html.trim();
  document.body.append(host);
  return host.firstElementChild as T;
}

const $ = <T extends Element = HTMLInputElement>(root: ParentNode, sel: string) =>
  root.querySelector(sel) as T;

function type(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
function check(el: HTMLInputElement, checked = true) {
  el.checked = checked;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
const blur = (el: Element) => el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
const submitEvent = (form: HTMLFormElement) => {
  const ev = new Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(ev);
  return ev;
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('bind / unbind', () => {
  it('binds an element or a selector and returns an unbind function', () => {
    const el = mount('<form id="f"><input name="a" value="x"></form>');
    const form = createForm({ a: field() });
    const unbind = form.bind('#f');
    expect(typeof unbind).toBe('function');
    expect(form.values.a).toBe('x');
    unbind();
    type($(el, 'input'), 'changed');
    expect(form.values.a).toBe('x');
  });

  it('throws for a selector that matches nothing', () => {
    expect(() => createForm().bind('#missing')).toThrow(/no element matches "#missing"/);
  });

  it('re-binding the same element is a no-op; binding another element moves the binding', () => {
    const a = mount('<form><input name="x"></form>');
    const b = mount('<form><input name="x"></form>');
    const form = createForm({ x: field() });
    const u1 = form.bind(a);
    expect(form.bind(a)).toBe(u1);
    form.bind(b);
    type($(a, 'input'), 'from a');
    expect(form.values.x).toBeNull();
    type($(b, 'input'), 'from b');
    expect(form.values.x).toBe('from b');
    expect(a.noValidate).toBe(false);
  });

  it('sets novalidate on a form and restores it on unbind', () => {
    const el = mount('<form><input name="a"></form>');
    const form = createForm();
    form.bind(el);
    expect(el.noValidate).toBe(true);
    form.unbind();
    expect(el.noValidate).toBe(false);
    const already = mount('<form novalidate><input name="a"></form>');
    form.bind(already);
    form.unbind();
    expect(already.noValidate).toBe(true);
  });

  it('works with a non-form container', () => {
    const el = mount<HTMLDivElement>('<div><input name="a" required></div>');
    const form = createForm();
    form.bind(el);
    expect(form.controls.a?.errors).toEqual(['This field is required']);
    type($(el, 'input'), 'ok');
    expect(form.valid).toBe(true);
  });

  it('unbind without a binding is a no-op', () => {
    expect(() => createForm().unbind()).not.toThrow();
  });
});

describe('zero-config: controls and rules from HTML', () => {
  it('creates a control for every named, non-button input', () => {
    const el = mount(`<form>
      <input name="a"><textarea name="b"></textarea><select name="c"><option value="1">1</option></select>
      <input type="hidden" name="token" value="t"><input type="submit" name="go"><button name="btn">x</button>
      <input type="checkbox" name="agree" value="yes"><input>
    </form>`);
    const form = createForm();
    form.bind(el);
    expect(Object.keys(form.controls)).toEqual(['a', 'b', 'c', 'token', 'agree']);
    expect(form.values).toEqual({ a: null, b: null, c: '1', token: 't', agree: null });
  });

  it('required', () => {
    const form = createForm();
    form.bind(mount('<form><input name="a" required></form>'));
    expect(form.controls.a?.errors).toEqual(['This field is required']);
  });

  it('type=email and type=url (http/https only — no javascript: links)', () => {
    const el = mount('<form><input name="e" type="email"><input name="u" type="url"></form>');
    const form = createForm();
    form.bind(el);
    type($(el, '[name=e]'), 'nope');
    type($(el, '[name=u]'), 'https://example.com/a?b');
    expect(form.controls.e?.errors).toEqual(['This field must be a valid email address']);
    expect(form.controls.u?.errors).toEqual([]);
    for (const bad of ['not a url', 'javascript:alert(1)', 'mailto:a@b.co', 'https://google']) {
      type($(el, '[name=u]'), bad);
      expect(form.controls.u?.errors, bad).toEqual(['This field must be a valid URL']);
    }
  });

  it('a declared url({ protocols: [] }) allows any scheme on a type=url input', () => {
    const el = mount('<form><input name="u" type="url" value="mailto:a@b.co"></form>');
    const form = createForm({ u: field().url({ protocols: [] }) });
    form.bind(el);
    expect(form.controls.u.errors).toEqual([]);
  });

  it('type=number with min/max', () => {
    const el = mount('<form><input name="n" type="number" min="1" max="10"></form>');
    const form = createForm();
    form.bind(el);
    type($(el, 'input'), '11');
    expect(form.controls.n?.errors).toEqual(['This field must be at most 10']);
    type($(el, 'input'), '0');
    expect(form.controls.n?.errors).toEqual(['This field must be at least 1']);
    type($(el, 'input'), '5');
    expect(form.controls.n?.valid).toBe(true);
  });

  it('type=date with min/max', () => {
    const el = mount('<form><input name="d" type="date" min="2024-01-01" max="2024-12-31"></form>');
    const form = createForm();
    form.bind(el);
    type($(el, 'input'), '2023-06-01');
    expect(form.controls.d?.errors).toEqual(['This field must be on or after 2024-01-01']);
    type($(el, 'input'), '2025-06-01');
    expect(form.controls.d?.errors).toEqual(['This field must be on or before 2024-12-31']);
  });

  it('minlength / maxlength', () => {
    const el = mount('<form><input name="a" minlength="3" maxlength="5"></form>');
    const form = createForm();
    form.bind(el);
    type($(el, 'input'), 'ab');
    expect(form.controls.a?.errors).toEqual(['This field must be at least 3 characters']);
    type($(el, 'input'), 'abcdef');
    expect(form.controls.a?.errors).toEqual(['This field must be at most 5 characters']);
  });

  it('pattern is anchored like the browser', () => {
    const el = mount('<form><input name="a" pattern="\\d{3}"></form>');
    const form = createForm();
    form.bind(el);
    type($(el, 'input'), '1234');
    expect(form.controls.a?.errors).toEqual(['This field is not in the expected format']);
    type($(el, 'input'), '123');
    expect(form.controls.a?.valid).toBe(true);
  });

  it('an invalid pattern attribute is ignored', () => {
    const el = mount('<form><input name="a" pattern="("></form>');
    const form = createForm();
    form.bind(el);
    type($(el, 'input'), 'x');
    expect(form.controls.a?.valid).toBe(true);
  });

  it('adds attribute rules to declared fields, but explicit rule kinds win', () => {
    const el = mount('<form><input name="a" minlength="5" required></form>');
    const form = createForm({ a: field().minLength(2, 'custom min') });
    form.bind(el);
    expect(form.controls.a.errors).toEqual(['This field is required']);
    type($(el, 'input'), 'abc');
    expect(form.controls.a.errors).toEqual([]);
    type($(el, 'input'), 'a');
    expect(form.controls.a.errors).toEqual(['custom min']);
  });

  it('never augments schema-backed controls', () => {
    const el = mount('<form><input name="a" required minlength="9"></form>');
    const form = createForm({ a: z.string().nullable() });
    form.bind(el);
    expect(form.controls.a.valid).toBe(true);
  });

  it('creates controls for inputs added after bind', () => {
    const el = mount('<form><input name="a"></form>');
    const form = createForm();
    form.bind(el);
    const later = document.createElement('input');
    later.name = 'late';
    later.required = true;
    el.append(later);
    type(later, 'hello');
    expect(form.values.late).toBe('hello');
    type(later, '');
    expect(form.controls.late?.errors).toEqual(['This field is required']);
  });

  it('html: false skips inference', () => {
    const el = mount('<form><input name="a" required><input name="b" required></form>');
    const form = createForm({ a: field() }, { html: false });
    form.bind(el);
    expect(Object.keys(form.controls)).toEqual(['a']);
    expect(form.controls.a.valid).toBe(true);
    type($(el, '[name=b]'), 'x');
    expect(Object.keys(form.controls)).toEqual(['a']);
  });
});

describe('labels', () => {
  it('reads <label for>, stripping "*" and ":"', () => {
    const el = mount(
      '<form><label for="e">Email address *</label><input id="e" name="email" required></form>',
    );
    const form = createForm();
    form.bind(el);
    expect(form.controls.email?.label).toBe('Email address');
    expect(form.controls.email?.errors).toEqual(['Email address is required']);
  });

  it('reads a wrapping label without nested inputs or error text', () => {
    const el = mount(
      '<form><label>Name: <input name="n" required><span data-formidate-error="n">Old error</span></label></form>',
    );
    const form = createForm();
    form.bind(el);
    expect(form.controls.n?.label).toBe('Name');
  });

  it('reads aria-label', () => {
    const form = createForm();
    form.bind(mount('<form><input name="q" aria-label="Search"></form>'));
    expect(form.controls.q?.label).toBe('Search');
  });

  it('uses <legend> for radio and checkbox groups', () => {
    const el = mount(`<form><fieldset><legend>Plan</legend>
      <label><input type="radio" name="plan" value="a" required> A</label>
      <label><input type="radio" name="plan" value="b"> B</label></fieldset></form>`);
    const form = createForm();
    form.bind(el);
    expect(form.controls.plan?.label).toBe('Plan');
    expect(form.controls.plan?.errors).toEqual(['Plan is required']);
  });

  it('an explicit label() wins over the DOM', () => {
    const el = mount('<form><label for="e">DOM</label><input id="e" name="e"></form>');
    const form = createForm({ e: field().label('Code') });
    form.bind(el);
    expect(form.controls.e.label).toBe('Code');
  });

  it('falls back to the fallback label', () => {
    const form = createForm();
    form.bind(mount('<form><input name="x"></form>'));
    expect(form.controls.x?.label).toBe('This field');
  });
});

describe('reading values', () => {
  it('text: blank becomes null', () => {
    const el = mount('<form><input name="a"></form>');
    const form = createForm({ a: field() });
    form.bind(el);
    type($(el, 'input'), '   ');
    expect(form.values.a).toBeNull();
    type($(el, 'input'), 'x');
    expect(form.values.a).toBe('x');
  });

  it('single checkbox: value when checked, else null', () => {
    const el = mount('<form><input type="checkbox" name="agree" value="yes"></form>');
    const form = createForm({ agree: field().required() });
    form.bind(el);
    expect(form.values.agree).toBeNull();
    check($(el, 'input'));
    expect(form.values.agree).toBe('yes');
    check($(el, 'input'), false);
    expect(form.values.agree).toBeNull();
  });

  it('radio group: the checked value', () => {
    const el = mount(
      '<form><input type="radio" name="r" value="a"><input type="radio" name="r" value="b"><input type="radio" name="r" value="c"></form>',
    );
    const form = createForm({ r: field() });
    form.bind(el);
    expect(form.values.r).toBeNull();
    check($(el, '[value=b]'));
    expect(form.values.r).toBe('b');
  });

  it('checkbox group: array for .array() fields and for undeclared inputs', () => {
    const el = mount(`<form>
      <input type="checkbox" name="tags" value="a"><input type="checkbox" name="tags" value="b" checked>
      <input type="checkbox" name="auto" value="x" checked><input type="checkbox" name="auto" value="y" checked>
    </form>`);
    const form = createForm({ tags: field().array().required() });
    form.bind(el);
    expect(form.values.tags).toEqual(['b']);
    expect((form.values as Record<string, unknown>).auto).toEqual(['x', 'y']);
    check($(el, '[name=tags][value=a]'));
    expect(form.values.tags).toEqual(['a', 'b']);
  });

  it('several text inputs sharing a name in an .array() field', () => {
    const el = mount(
      '<form><input name="e" value="a"><input name="e" value=""><input name="e" value="c"></form>',
    );
    const form = createForm({ e: field().array() });
    form.bind(el);
    expect(form.values.e).toEqual(['a', 'c']);
  });

  it('select multiple', () => {
    const el = mount(`<form><select name="s" multiple>
      <option value="a" selected>A</option><option value="b">B</option><option value="c" selected>C</option>
    </select><select name="one" multiple><option value="x" selected>X</option></select></form>`);
    const form = createForm({ s: field().array(), one: field() });
    form.bind(el);
    expect(form.values.s).toEqual(['a', 'c']);
    expect(form.values.one).toBe('x'); // declared scalar → first selected
  });

  it('dot notation assembles nested objects and arrays', () => {
    const el = mount(`<form>
      <input name="address.street" value="Main"><input name="address.zip" value="12345">
      <input name="rows.0.name" value="A"><input name="rows.1.name" value="B">
      <input name="items.0" value="x"><input name="items.1" value="y">
      <input name="my-text[0]" value="bracket">
      <input name="bad[name" value="literal">
    </form>`);
    const form = createForm();
    form.bind(el);
    expect(form.values.address).toEqual({ street: 'Main', zip: '12345' });
    expect(form.values.rows).toEqual([{ name: 'A' }, { name: 'B' }]);
    expect(form.values.items).toEqual(['x', 'y']);
    expect(form.values['my-text']).toEqual(['bracket']); // brackets build structure like servers do
    expect(form.values['bad[name']).toBe('literal'); // malformed names stay flat keys
    type($(el, '[name="address.zip"]'), '99999');
    expect(form.values.address).toEqual({ street: 'Main', zip: '99999' });
  });

  it('data-formidate-control overrides name', () => {
    const el = mount(
      '<form><input name="user_email_v2" data-formidate-control="email" value="a@b.c"></form>',
    );
    const form = createForm({ email: field().email() });
    form.bind(el);
    expect(form.values.email).toBe('a@b.c');
    expect(Object.keys(form.controls)).toEqual(['email']);
  });

  it('reads inputs associated with form="id" outside the form', () => {
    mount('<input name="outside" form="f" value="o">');
    const el = mount('<form id="f"><input name="inside"></form>');
    const form = createForm();
    form.bind(el);
    expect(form.values.outside).toBe('o');
  });

  it('tracks typing in inputs associated with form="id" outside the form', () => {
    const outside = mount<HTMLInputElement>('<input name="outside" form="f2">');
    const el = mount('<form id="f2"><input name="inside"></form>');
    const form = createForm();
    form.bind(el);
    type(outside, 'typed');
    expect(form.values.outside).toBe('typed');
  });
});

describe('value source of truth', () => {
  it('writes explicit defaults into inputs on bind', () => {
    const el = mount('<form><input name="a" value="dom"></form>');
    const form = createForm({ a: field('james') });
    form.bind(el);
    expect($(el, 'input').value).toBe('james');
    expect(form.values.a).toBe('james');
  });

  it('reads the DOM when there is no default, and that becomes the initial value', () => {
    const el = mount('<form><input name="a" value="dom"></form>');
    const form = createForm({ a: field() });
    form.bind(el);
    expect(form.values.a).toBe('dom');
    expect(form.controls.a.dirty).toBe(false);
    type($(el, 'input'), 'x');
    expect(form.controls.a.dirty).toBe(true);
  });

  it('writes values set before bind', () => {
    const el = mount('<form><input name="a"></form>');
    const form = createForm({ a: field() });
    form.setValue('a', 'early');
    form.bind(el);
    expect($(el, 'input').value).toBe('early');
  });

  it('setValue and reset mirror into text, checkbox, radio and select inputs', () => {
    const el = mount(`<form>
      <input name="t"><input type="checkbox" name="c" value="on">
      <input type="radio" name="r" value="a"><input type="radio" name="r" value="b">
      <input type="checkbox" name="tags" value="x"><input type="checkbox" name="tags" value="y">
      <select name="m" multiple><option value="1">1</option><option value="2">2</option></select>
      <input type="file" name="f">
    </form>`);
    const form = createForm({
      t: field('init'),
      c: field(),
      r: field(),
      tags: field().array(),
      m: field().array(),
      f: field(),
    });
    form.bind(el);
    form.setValues({ t: 'next', c: 'on', r: 'b', tags: ['y'], m: ['2'], f: 'C:\\fakepath\\x' });
    expect($(el, '[name=t]').value).toBe('next');
    expect($(el, '[name=c]').checked).toBe(true);
    expect($(el, '[name=r][value=b]').checked).toBe(true);
    expect($(el, '[name=r][value=a]').checked).toBe(false);
    expect($(el, '[name=tags][value=y]').checked).toBe(true);
    expect($(el, '[name=tags][value=x]').checked).toBe(false);
    expect(Array.from($<HTMLSelectElement>(el, 'select').selectedOptions).map((o) => o.value)).toEqual(['2']);
    expect($(el, '[name=f]').value).toBe('');
    form.reset();
    expect($(el, '[name=t]').value).toBe('init');
    expect($(el, '[name=c]').checked).toBe(false);
    expect($(el, '[name=tags][value=y]').checked).toBe(false);
  });

  it('writes nested values and positional arrays', () => {
    const el = mount(
      '<form><input name="address.zip"><input name="address.city"><input name="list"><input name="list"></form>',
    );
    const form = createForm({ address: field(), list: field().array() });
    form.bind(el);
    form.setValues({ address: { zip: '1', city: 'C' } as never, list: ['p', 'q'] });
    expect($(el, '[name="address.zip"]').value).toBe('1');
    expect($(el, '[name="address.city"]').value).toBe('C');
    expect(Array.from(el.querySelectorAll<HTMLInputElement>('[name=list]')).map((i) => i.value)).toEqual([
      'p',
      'q',
    ]);
  });

  it('addFields after bind reads the DOM', () => {
    const el = mount('<form><input name="later" value="v"></form>');
    const form = createForm({}, { html: false });
    form.bind(el);
    form.addFields({ later: field().required() });
    expect((form.values as Record<string, unknown>).later).toBe('v');
  });
});

describe('touched and disabled', () => {
  it('focusout marks the control touched', () => {
    const el = mount('<form><input name="a"><input name="b"></form>');
    const form = createForm({ a: field(), b: field() });
    form.bind(el);
    blur($(el, '[name=a]'));
    expect(form.controls.a.touched).toBe(true);
    expect(form.controls.b.touched).toBe(false);
  });

  it('inputs disabled at bind (attribute or fieldset) start disabled', () => {
    const el = mount(
      '<form><input name="a" disabled required><fieldset disabled><input name="b" required></fieldset><input name="c" required></form>',
    );
    const form = createForm();
    form.bind(el);
    expect(form.controls.a?.disabled).toBe(true);
    expect(form.controls.b?.disabled).toBe(true);
    expect(form.controls.c?.disabled).toBe(false);
  });

  it('disable() / enable() mirror to the inputs', () => {
    const el = mount('<form><input name="a"></form>');
    const form = createForm({ a: field() });
    form.bind(el);
    form.disable('a');
    expect($(el, 'input').disabled).toBe(true);
    form.enable('a');
    expect($(el, 'input').disabled).toBe(false);
  });
});

describe('aria', () => {
  const html = `<form>
    <label for="e">Email</label><input id="e" name="email" type="email" required aria-describedby="hint">
    <span id="hint">We never share it</span>
    <p data-formidate-error="email"></p>
  </form>`;

  it('sets aria-invalid only after touched, and removes it when fixed', () => {
    const el = mount(html);
    const form = createForm();
    form.bind(el);
    const input = $(el, 'input');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    blur(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    type(input, 'a@b.co');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });

  it('fills error slots, toggles hidden, assigns an id and links aria-describedby', () => {
    const el = mount(html);
    const form = createForm();
    form.bind(el);
    const input = $(el, 'input');
    const slot = $<HTMLElement>(el, '[data-formidate-error]');
    expect(slot.hidden).toBe(true);
    expect(slot.textContent).toBe('');
    expect(slot.id).not.toBe('');
    expect(input.getAttribute('aria-describedby')).toBe(`hint ${slot.id}`);
    type(input, 'bad');
    blur(input);
    expect(slot.hidden).toBe(false);
    expect(slot.textContent).toBe('Email must be a valid email address');
    type(input, 'a@b.co');
    expect(slot.hidden).toBe(true);
  });

  it('keeps an existing slot id', () => {
    const el = mount('<form><input name="a" required><p id="mine" data-formidate-error="a"></p></form>');
    const form = createForm();
    form.bind(el);
    expect($(el, 'input').getAttribute('aria-describedby')).toBe('mine');
  });

  it('nested slots show issues for their path only', () => {
    const el = mount(`<form>
      <input name="address.zip"><p data-formidate-error="address.zip"></p>
      <input name="address.city"><p data-formidate-error="address.city"></p>
    </form>`);
    const form = createForm({
      address: z.object({ zip: z.string().regex(/^\d{5}$/, 'Bad ZIP'), city: z.string().min(1, 'City?') }),
    });
    form.bind(el);
    type($(el, '[name="address.zip"]'), '1');
    type($(el, '[name="address.city"]'), 'Paris');
    blur($(el, '[name="address.zip"]'));
    const zip = $(el, '[name="address.zip"]');
    const city = $(el, '[name="address.city"]');
    expect(zip.getAttribute('aria-invalid')).toBe('true');
    expect(city.hasAttribute('aria-invalid')).toBe(false);
    const [zipSlot, citySlot] = Array.from(el.querySelectorAll<HTMLElement>('[data-formidate-error]'));
    expect(zipSlot!.textContent).toBe('Bad ZIP');
    expect(citySlot!.hidden).toBe(true);
    expect(zip.getAttribute('aria-describedby')).toBe(zipSlot!.id);
    expect(city.getAttribute('aria-describedby')).toBe(citySlot!.id);
  });

  it('unbind removes aria-invalid and the ids it added to aria-describedby', () => {
    const el = mount(html);
    const form = createForm();
    form.bind(el);
    const input = $(el, 'input');
    blur(input);
    form.unbind();
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.getAttribute('aria-describedby')).toBe('hint');
  });

  it('unbind removes aria-describedby entirely when Formidate added the only id', () => {
    const el = mount('<form><input name="a"><p data-formidate-error="a"></p></form>');
    const form = createForm();
    form.bind(el);
    form.unbind();
    expect($(el, 'input').hasAttribute('aria-describedby')).toBe(false);
  });

  it('removes aria-invalid from inputs of removed controls', () => {
    const el = mount('<form><input name="a" required></form>');
    const form = createForm();
    form.bind(el);
    blur($(el, 'input'));
    form.removeFields('a');
    expect($(el, 'input').hasAttribute('aria-invalid')).toBe(false);
  });

  it('aria: false leaves the DOM alone', () => {
    const el = mount(html);
    const form = createForm({}, { aria: false });
    form.bind(el);
    blur($(el, 'input'));
    expect($(el, 'input').hasAttribute('aria-invalid')).toBe(false);
    expect($(el, 'input').getAttribute('aria-describedby')).toBe('hint');
    expect($<HTMLElement>(el, '[data-formidate-error]').hidden).toBe(false);
  });
});

describe('submission', () => {
  it('the native submit gate blocks invalid forms, touches all and focuses the first invalid input', () => {
    const el = mount(
      '<form><input name="ok" value="x"><input name="a" required><input name="b" required></form>',
    );
    const form = createForm();
    form.bind(el);
    const ev = submitEvent(el);
    expect(ev.defaultPrevented).toBe(true);
    expect(form.controls.a?.touched).toBe(true);
    expect(form.controls.b?.touched).toBe(true);
    expect(document.activeElement).toBe($(el, '[name=a]'));
  });

  it('lets a valid form submit natively', () => {
    const el = mount('<form><input name="a" value="x" required></form>');
    const form = createForm();
    form.bind(el);
    expect(submitEvent(el).defaultPrevented).toBe(false);
  });

  it('blocks while async validation is pending', () => {
    const el = mount('<form><input name="u"></form>');
    const form = createForm({ u: field('bob').async(() => new Promise(() => {})) });
    form.bind(el);
    expect(submitEvent(el).defaultPrevented).toBe(true);
  });

  it('ignores submits already prevented by someone else', () => {
    const el = mount('<form><input name="a" required></form>');
    el.addEventListener('submit', (e) => e.preventDefault());
    const form = createForm();
    form.bind(el);
    submitEvent(el);
    expect(form.controls.a?.touched).toBe(false);
  });

  it('focusOnError: false does not move focus', () => {
    const el = mount('<form><input name="a" required></form>');
    const form = createForm({}, { focusOnError: false });
    form.bind(el);
    submitEvent(el);
    expect(document.activeElement).toBe(document.body);
  });

  it('handleSubmit focuses the first invalid, enabled input', async () => {
    const el = mount(
      '<form><input name="a" required disabled><input name="b" required><input name="c"></form>',
    );
    const form = createForm({ a: field().required(), b: field().required(), c: field().required() });
    form.bind(el);
    form.enable('a');
    $(el, '[name=a]').disabled = true;
    await form.handleSubmit(() => {})();
    expect(document.activeElement).toBe($(el, '[name=b]'));
  });

  it('a native reset event resets the form state after the browser resets the inputs', () => {
    vi.useFakeTimers();
    const el = mount('<form><input name="a" value="orig"></form>');
    const form = createForm();
    form.bind(el);
    const input = $(el, 'input');
    type(input, 'changed');
    blur(input);
    el.reset();
    vi.runAllTimers();
    expect(form.values.a).toBe('orig');
    expect(input.value).toBe('orig');
    expect(form.controls.a?.touched).toBe(false);
  });
});

describe('type="email" uses the strict email rule', () => {
  it('rejects dotless domains the browser would accept', () => {
    const host = document.createElement('div');
    host.innerHTML = '<form><input name="e" type="email" value="asdf@gmail"></form>';
    document.body.append(host);
    const form = createForm();
    form.bind(host.querySelector('form')!);
    expect(form.controls.e?.errors).toEqual(['This field must be a valid email address']);
    host.remove();
  });

  it('a declared email({ allowLocal: true }) wins over the attribute', () => {
    const host = document.createElement('div');
    host.innerHTML = '<form><input name="e" type="email" value="admin@localhost"></form>';
    document.body.append(host);
    const form = createForm({ e: field().email({ allowLocal: true }) });
    form.bind(host.querySelector('form')!);
    expect(form.controls.e.errors).toEqual([]);
    host.remove();
  });
});

describe('browser parity for HTML-inferred rules', () => {
  const host = (html: string) => {
    const d = document.createElement('div');
    d.innerHTML = html;
    document.body.append(d);
    return d.querySelector('form')!;
  };

  it('hidden and readonly inputs are not validated by their attributes', () => {
    const el = host(
      '<form><input type="hidden" name="h" required><input name="ro" readonly required minlength="9" value="x"></form>',
    );
    const form = createForm();
    form.bind(el);
    expect(form.controls.h?.errors).toEqual([]);
    expect(form.controls.ro?.errors).toEqual([]);
    expect(form.valid).toBe(true);
  });

  it('declared rules still apply to hidden inputs', () => {
    const el = host('<form><input type="hidden" name="token"></form>');
    const form = createForm({ token: field().required('Missing token') });
    form.bind(el);
    expect(form.controls.token.errors).toEqual(['Missing token']);
  });

  it('type="email" multiple accepts a comma-separated list', () => {
    const el = host('<form><input name="e" type="email" multiple value="a@b.com, c@d.org"></form>');
    const form = createForm();
    form.bind(el);
    expect(form.controls.e?.errors).toEqual([]);
  });

  it('text the browser rejected in a number/date input (validity.badInput) is reported, not "required"', () => {
    const el = host(
      '<form><label for="n">Age</label><input id="n" name="age" type="number" required></form>',
    );
    const input = el.querySelector('input')!;
    let bad = false;
    Object.defineProperty(input, 'validity', { get: () => ({ badInput: bad }) });
    const form = createForm();
    form.bind(el);
    expect(form.controls.age?.errors).toEqual(['Age is required']);
    bad = true; // the user typed "12e": value reads as ''
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(form.controls.age?.errors).toEqual(['Age must be a number']);
  });

  it('badInput in one list row is reported at that row', () => {
    const el = host(
      '<form><input name="qty[]" type="number" value="2"><input name="qty[]" type="number"></form>',
    );
    const second = el.querySelectorAll('input')[1]!;
    Object.defineProperty(second, 'validity', { get: () => ({ badInput: true }) });
    const form = createForm();
    form.bind(el);
    expect(form.controls.qty?.issues).toEqual([{ message: 'This field must be a number', path: [1] }]);
  });
});
