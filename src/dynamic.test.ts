// Inputs added or removed after bind(): dynamic lists, conditional fields, framework re-renders.
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createForm, field } from './index';

const tick = () => new Promise<void>((r) => setTimeout(r, 0)); // let MutationObserver callbacks run

function mount(html: string): HTMLFormElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  return host.querySelector('form')!;
}
const input = (form: Element, name: string) => form.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
const type = (el: HTMLInputElement, value: string) => {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const blur = (el: HTMLElement) => el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
const slot = (form: Element, name: string) =>
  form.querySelector<HTMLElement>(`[data-formidate-error="${name}"]`)!;

/** Append a guest row the way an "Add" button would. */
function addGuest(form: HTMLFormElement): void {
  const i = form.querySelectorAll('.row').length;
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<input name="guests.${i}.name"><p data-formidate-error="guests.${i}.name"></p>
    <input name="guests.${i}.email"><p data-formidate-error="guests.${i}.email"></p>`;
  form.querySelector('.rows')!.append(row);
}
/** Remove a row and renumber the rest, like a "Remove" button would. */
function removeGuest(form: HTMLFormElement, index: number): void {
  form.querySelectorAll('.row')[index]!.remove();
  form.querySelectorAll('.row').forEach((row, i) => {
    for (const el of Array.from(row.querySelectorAll('[name],[data-formidate-error]'))) {
      for (const attr of ['name', 'data-formidate-error']) {
        const v = el.getAttribute(attr);
        if (v) el.setAttribute(attr, v.replace(/^guests\.\d+/, `guests.${i}`));
      }
    }
  });
}

// No rows = no inputs = null, so the `error` option also covers the "nothing added yet" case.
const guestsSchema = z
  .array(
    z.object({
      name: z.string({ error: 'Name is required' }).min(1, 'Name is required'),
      email: z.email({ error: 'Enter a valid email' }),
    }),
    { error: 'Add at least one guest' },
  )
  .min(1, 'Add at least one guest');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('inputs added after bind (MutationObserver)', () => {
  it('creates a control with HTML rules as soon as the input is added — no typing needed', async () => {
    const form = mount('<form><input name="a"></form>');
    const f = createForm();
    f.bind(form);
    form.insertAdjacentHTML('beforeend', '<input name="link1" type="url" required>');
    await tick();
    expect(f.controls.link1?.errors).toEqual(['This field is required']);
    expect(f.valid).toBe(false);
  });

  it('removes inferred controls when their inputs are removed', async () => {
    const form = mount('<form><input name="a"><input name="b" required></form>');
    const f = createForm();
    f.bind(form);
    expect(f.valid).toBe(false);
    input(form, 'b').remove();
    await tick();
    expect(Object.keys(f.controls)).toEqual(['a']);
    expect(f.valid).toBe(true);
  });

  it('keeps declared controls but empties them when all their inputs are removed', async () => {
    const form = mount('<form><input name="a" value="x"></form>');
    const f = createForm({ a: field().required() });
    f.bind(form);
    expect(f.values.a).toBe('x');
    input(form, 'a').remove();
    await tick();
    expect(f.values.a).toBeNull();
    expect(f.controls.a.errors).toEqual(['This field is required']);
  });

  it('keeps input-less (derived) controls untouched', async () => {
    const form = mount('<form><input name="a"></form>');
    const f = createForm({ total: field().required() });
    f.setValue('total', '42');
    f.bind(form);
    form.append(document.createElement('input'));
    input(form, 'a').remove();
    await tick();
    expect(f.values.total).toBe('42');
  });

  it('writes a code default into an input that mounts after bind', async () => {
    const form = mount('<form></form>');
    const f = createForm({ nick: field('neo') });
    f.bind(form);
    form.insertAdjacentHTML('beforeend', '<input name="nick">');
    await tick();
    expect(input(form, 'nick').value).toBe('neo');
    expect(f.values.nick).toBe('neo');
  });

  it('ignores mutations that only change text (e.g. error slots)', async () => {
    const form = mount('<form><input name="a" required><p data-formidate-error="a"></p></form>');
    const f = createForm();
    f.bind(form);
    let emits = 0;
    f.subscribe(() => emits++);
    emits = 0;
    f.touch('a'); // writes slot text → text-only mutation
    await tick();
    expect(emits).toBe(1);
  });

  it('refresh() re-reads attributes that changed', () => {
    const form = mount('<form><input name="a"></form>');
    const f = createForm();
    f.bind(form);
    expect(f.valid).toBe(true);
    input(form, 'a').required = true;
    f.refresh();
    expect(f.controls.a?.errors).toEqual(['This field is required']);
    input(form, 'a').disabled = true;
    f.refresh();
    expect(f.controls.a?.disabled).toBe(true);
    input(form, 'a').disabled = false;
    f.refresh();
    expect(f.controls.a?.disabled).toBe(false);
  });

  it('stops observing after unbind', async () => {
    const form = mount('<form><input name="a"></form>');
    const f = createForm();
    f.bind(form);
    f.unbind();
    form.insertAdjacentHTML('beforeend', '<input name="b" required>');
    await tick();
    expect(Object.keys(f.controls)).toEqual(['a']);
  });

  it("applies attribute rules per input inside nested controls, at that input's path", () => {
    const form = mount(
      '<form><label for="z">ZIP</label><input id="z" name="addr[zip]" required minlength="5"><input name="addr[city]"></form>',
    );
    const f = createForm();
    f.bind(form);
    expect(f.controls.addr?.issues).toEqual([{ message: 'ZIP is required', path: ['zip'] }]);
    type(input(form, 'addr[zip]'), '123');
    expect(f.controls.addr?.issues).toEqual([
      { message: 'ZIP must be at least 5 characters', path: ['zip'] },
    ]);
  });
});

describe('dynamic list with a schema (guests.N.name / guests.N.email)', () => {
  function setup() {
    const form = mount('<form><div class="rows"></div><p data-formidate-error="guests"></p></form>');
    const f = createForm({ guests: guestsSchema });
    f.bind(form);
    return { form, f };
  }

  it('starts empty and reports the list-level error in the list slot', async () => {
    const { form, f } = setup();
    expect(f.values.guests).toBeNull();
    await f.handleSubmit(() => {})();
    expect(slot(form, 'guests').textContent).toBe('Add at least one guest');
  });

  it('picks up added rows, validates each row, and routes errors to row slots', async () => {
    const { form, f } = setup();
    addGuest(form);
    addGuest(form);
    await tick();
    expect(f.values.guests).toEqual([
      { name: null, email: null },
      { name: null, email: null },
    ]);
    type(input(form, 'guests.0.name'), 'Ada');
    type(input(form, 'guests.0.email'), 'nope');
    blur(input(form, 'guests.0.email'));
    // only the blurred input shows its error; the untouched new row stays quiet
    expect(slot(form, 'guests.0.email').textContent).toBe('Enter a valid email');
    expect(input(form, 'guests.0.email').getAttribute('aria-invalid')).toBe('true');
    expect(slot(form, 'guests.1.name').textContent).toBe('');
    expect(input(form, 'guests.1.name').hasAttribute('aria-invalid')).toBe(false);
    // the list slot does not repeat row errors
    expect(slot(form, 'guests').textContent).toBe('');
  });

  it('submit reveals every row error; fixing them submits the typed list', async () => {
    const { form, f } = setup();
    addGuest(form);
    await tick();
    let out: unknown;
    await f.handleSubmit((v) => {
      out = v;
    })();
    expect(out).toBeUndefined();
    expect(slot(form, 'guests.0.name').textContent).toBe('Name is required');
    expect(slot(form, 'guests.0.email').textContent).toBe('Enter a valid email');
    type(input(form, 'guests.0.name'), 'Ada');
    type(input(form, 'guests.0.email'), 'ada@example.com');
    await f.handleSubmit((v) => {
      out = v;
    })();
    expect(out).toEqual({ guests: [{ name: 'Ada', email: 'ada@example.com' }] });
  });

  it('removing a row (and renumbering) updates the value; removing all rows empties the list', async () => {
    const { form, f } = setup();
    addGuest(form);
    addGuest(form);
    await tick();
    type(input(form, 'guests.0.name'), 'Ada');
    type(input(form, 'guests.1.name'), 'Bob');
    removeGuest(form, 0);
    await tick();
    expect(f.values.guests).toEqual([{ name: 'Bob', email: null }]);
    removeGuest(form, 0);
    await tick();
    expect(f.values.guests).toBeNull();
    expect(f.controls.guests.errors).toEqual(['Add at least one guest']);
  });

  it('a value set in code before the rows exist is written into the rows that connect first', async () => {
    const form = mount('<form><div class="rows"></div></form>');
    const f = createForm({ guests: guestsSchema });
    f.setValue('guests', [{ name: 'Ada', email: 'ada@example.com' }]);
    addGuest(form);
    f.bind(form);
    expect(input(form, 'guests.0.name').value).toBe('Ada');
    // after connecting, the DOM is the source of truth: adding a row extends the value
    addGuest(form);
    await tick();
    expect(f.values.guests).toEqual([
      { name: 'Ada', email: 'ada@example.com' },
      { name: null, email: null },
    ]);
  });
});

describe('dynamic flat inputs declared in code (addFields / removeFields)', () => {
  it('validates each added input with its own rules and drops it on remove', async () => {
    const form = mount('<form><div class="phones"></div></form>');
    const f = createForm(undefined, { html: false }); // no static fields: names are dynamic
    f.bind(form);
    form.querySelector('.phones')!.insertAdjacentHTML('beforeend', '<input name="phone1">');
    f.addFields({
      phone1: field()
        .label('Phone 1')
        .required()
        .pattern(/^\+?[0-9 ]{7,15}$/),
    });
    type(input(form, 'phone1'), '12');
    expect(f.controls.phone1?.errors).toEqual(['Phone 1 is not in the expected format']);
    input(form, 'phone1').remove();
    f.removeFields('phone1');
    await tick();
    expect(f.valid).toBe(true);
  });
});

describe('bracket names, as sent to the server (PHP, Rails, qs)', () => {
  it('parses a[b], a[0][b], mixed a[0].b, and keeps malformed names flat', () => {
    const form = mount(`<form>
      <input name="user[name]" value="Ada"><input name="user[tags][0]" value="x">
      <input name="rows[0].name" value="A"><input name="rows[1][name]" value="B">
      <input name="odd[" value="1">
    </form>`);
    const f = createForm();
    f.bind(form);
    expect(f.values.user).toEqual({ name: 'Ada', tags: ['x'] });
    expect(f.values.rows).toEqual([{ name: 'A' }, { name: 'B' }]);
    expect(f.values['odd[']).toBe('1');
  });

  it('emails[] text inputs build a positional list (blank rows → null) validated per row', () => {
    const form = mount(`<form>
      <input name="emails[]" type="email" required aria-label="Email" value="a@example.com"><p data-formidate-error="emails[]"></p>
      <input name="emails[]" type="email" required aria-label="Email" value="nope"><p data-formidate-error="emails[]"></p>
      <input name="emails[]" type="email" required aria-label="Email"><p data-formidate-error="emails[]"></p>
    </form>`);
    const f = createForm();
    f.bind(form);
    expect(f.values.emails).toEqual(['a@example.com', 'nope', null]);
    expect(f.controls.emails?.issues).toEqual([
      { message: 'Email must be a valid email address', path: [1] },
      { message: 'Email is required', path: [2] },
    ]);
    // touched per row: blurring row 2 only reveals row 2's error
    const rows = form.querySelectorAll<HTMLInputElement>('input');
    const slots = form.querySelectorAll<HTMLElement>('[data-formidate-error]');
    blur(rows[1]!);
    expect([...slots].map((s) => s.textContent)).toEqual(['', 'Email must be a valid email address', '']);
    expect(rows[1]!.getAttribute('aria-invalid')).toBe('true');
    expect(rows[2]!.hasAttribute('aria-invalid')).toBe(false);
    expect(rows[1]!.getAttribute('aria-describedby')).toBe(slots[1]!.id);
  });

  it('adding and removing emails[] rows needs no renumbering', async () => {
    const form = mount('<form><div class="list"></div></form>');
    const f = createForm();
    f.bind(form);
    const list = form.querySelector('.list')!;
    const add = (v = '') =>
      list.insertAdjacentHTML(
        'beforeend',
        `<div><input name="emails[]" type="email" required value="${v}"></div>`,
      );
    add('a@example.com');
    add('b@example.com');
    add();
    await tick();
    expect(f.values.emails).toEqual(['a@example.com', 'b@example.com', null]);
    expect(f.valid).toBe(false);
    list.children[2]!.remove();
    list.children[0]!.remove();
    await tick();
    expect(f.values.emails).toEqual(['b@example.com']);
    expect(f.valid).toBe(true);
  });

  it('checkbox lists with [] collect checked values', () => {
    const form = mount(`<form>
      <input type="checkbox" name="tags[]" value="a" checked><input type="checkbox" name="tags[]" value="b">
      <input type="checkbox" name="tags[]" value="c" checked>
    </form>`);
    const f = createForm({ tags: field().array().minItems(1) });
    f.bind(form);
    expect(f.values.tags).toEqual(['a', 'c']);
  });

  it('blank rows do not satisfy required / minItems on a list', () => {
    const f = createForm({ emails: field().array().required().minItems(2) });
    f.setValue('emails', ['a@example.com', null as unknown as string]);
    expect(f.controls.emails.errors).toEqual(['This field must have at least 2 items']);
    f.setValue('emails', [null as unknown as string]);
    expect(f.controls.emails.errors[0]).toBe('This field is required');
  });

  it('element-wise code rules report the failing entry path', () => {
    const f = createForm({ emails: field().array().email() });
    f.setValue('emails', ['a@example.com', 'bad', 'worse']);
    expect(f.controls.emails.issues.map((i) => i.path)).toEqual([[1], [2]]);
  });

  it('a code rule wins over the same attribute rule on list rows', () => {
    const form = mount('<form><input name="codes[]" minlength="5" value="abc"></form>');
    const f = createForm({ codes: field().array().minLength(2, 'Too short') });
    f.bind(form);
    expect(f.controls.codes.errors).toEqual([]);
  });
});
