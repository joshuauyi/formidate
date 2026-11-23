// Memory, re-render and dynamic-list edge cases.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createForm, field } from './index';

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

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
const blur = (el: HTMLElement) => el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('memory', () => {
  it('adds no document-level listeners, so a removed form that was never unbound can be collected', () => {
    const spy = vi.spyOn(document, 'addEventListener');
    createForm().bind(mount('<form><input name="a"></form>'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('still tracks inputs associated with form="id" from outside the form', () => {
    const el = mount('<form id="f"></form>');
    document.body.insertAdjacentHTML('beforeend', '<input name="out" form="f">');
    const form = createForm();
    form.bind(el);
    type(document.querySelector<HTMLInputElement>('[name="out"]')!, 'x');
    expect(form.values).toEqual({ out: 'x' });
    form.unbind();
    type(document.querySelector<HTMLInputElement>('[name="out"]')!, 'y');
    expect(form.values).toEqual({ out: 'x' });
  });

  it('forgets removed inputs and error slots', async () => {
    const el = mount(`<form><div class="rows">
      <div><input name="emails[]" required><p data-formidate-error="emails[]"></p></div>
      <div><input name="emails[]" required><p data-formidate-error="emails[]"></p></div>
    </div></form>`);
    const form = createForm();
    form.bind(el);
    form.touch();
    const internals = form as unknown as {
      ariaInvalid: Set<Element>;
      describedBy: Map<Element, unknown>;
      slots: Map<Element, unknown>;
    };
    expect(internals.ariaInvalid.size).toBe(2);
    el.querySelector('.rows > div')!.remove();
    await tick();
    expect(internals.ariaInvalid.size).toBe(1);
    expect(internals.describedBy.size).toBe(1);
    expect(internals.slots.size).toBe(1);
  });
});

describe('dynamic lists', () => {
  it('does not show a new row as touched because a removed row at that index was', async () => {
    const el = mount(`<form><div class="rows">
      <div><input name="emails[]" required><p data-formidate-error="emails[]"></p></div>
      <div><input name="emails[]" required><p data-formidate-error="emails[]"></p></div>
    </div></form>`);
    const form = createForm();
    form.bind(el);
    const rows = el.querySelector('.rows')!;
    blur(rows.lastElementChild!.querySelector('input')!);
    rows.lastElementChild!.remove();
    await tick();
    rows.insertAdjacentHTML(
      'beforeend',
      '<div><input name="emails[]" required><p data-formidate-error="emails[]"></p></div>',
    );
    await tick();
    const fresh = rows.lastElementChild!.querySelector('input')!;
    expect(fresh.getAttribute('aria-invalid')).toBeNull();
    expect(rows.lastElementChild!.querySelector('p')!.textContent).toBe('');
  });

  it('a declared list with all its rows removed has no rules left from those rows', async () => {
    const el = mount('<form><div class="rows"><div><input name="phones[]" required></div></div></form>');
    const form = createForm({ phones: field().array() });
    form.bind(el);
    expect(form.valid).toBe(false);
    el.querySelector('.rows > div')!.remove();
    await tick();
    expect(form.values.phones).toEqual([]);
    expect(form.valid).toBe(true);
  });

  it('focuses the first invalid row on submit, not the first row', async () => {
    const el = mount(`<form>
      <input name="emails[]" type="email" value="a@b.co"><input name="emails[]" type="email" value="nope">
    </form>`);
    const form = createForm();
    form.bind(el);
    await form.handleSubmit(() => {})();
    expect(document.activeElement).toBe(el.querySelectorAll('input')[1]);
  });
});

describe('seamless', () => {
  it('validate() picks up values set without events (autofill, scripts)', async () => {
    const el = mount('<form><input name="email" required></form>');
    const form = createForm();
    form.bind(el);
    el.querySelector('input')!.value = 'a@b.co';
    expect(await form.validate()).toBe(true);
    expect(form.values).toEqual({ email: 'a@b.co' });
  });

  it('the native submit gate also reads the current input values', () => {
    const el = mount('<form><input name="email" required><button>go</button></form>');
    createForm().bind(el);
    el.querySelector('input')!.value = 'a@b.co';
    const event = new Event('submit', { cancelable: true });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not notify listeners when nothing changed', () => {
    const el = mount('<form><input name="email" required></form>');
    const form = createForm();
    form.bind(el);
    const input = el.querySelector('input')!;
    type(input, 'a');
    const listener = vi.fn();
    form.subscribe(listener);
    listener.mockClear();
    const before = form.getState();
    input.dispatchEvent(new Event('change', { bubbles: true })); // same value again
    expect(listener).not.toHaveBeenCalled();
    expect(form.getState()).toBe(before);
  });
});

describe('independent review findings', () => {
  const submit = (el: HTMLFormElement) => {
    const event = new Event('submit', { cancelable: true });
    el.dispatchEvent(event);
    return event.defaultPrevented;
  };

  it('leaves disabled inputs out of a control, like FormData', () => {
    const el = mount(`<form>
      <input name="emails[]" type="email" value="ok@x.com"><input name="emails[]" type="email" value="bad" disabled>
      <input type="checkbox" name="tags[]" value="a" checked><input type="checkbox" name="tags[]" value="b" checked disabled>
    </form>`);
    const form = createForm();
    form.bind(el);
    expect(form.values).toEqual({ emails: ['ok@x.com'], tags: ['a'] });
    expect(form.valid).toBe(true);
    expect(submit(el)).toBe(false);
  });

  it('ignores an unparsable date min/max instead of throwing', async () => {
    const el = mount(
      '<form><input type="date" name="d" min="today" max="2024-13-01" value="2024-05-31"></form>',
    );
    const form = createForm();
    expect(() => form.bind(el)).not.toThrow();
    el.insertAdjacentHTML('beforeend', '<input type="date" name="e" min="nope">');
    await tick();
    expect(Object.keys(form.controls)).toEqual(['d', 'e']);
    expect(form.valid).toBe(true);
  });

  it.each([
    ['', '1.5', false],
    ['', '2', true],
    ['step="any"', '1.5', true],
    ['step="0.01"', '1.25', true],
    ['step="5" min="0"', '7', false],
    ['step="5" min="0"', '10', true],
    ['step="2" min="1"', '3', true],
    ['step="2" min="1"', '4', false],
  ])('number input %s: %s valid=%s (step, like browsers)', (attrs, value, valid) => {
    const el = mount(`<form><input type="number" name="n" ${attrs} value="${value}"></form>`);
    const form = createForm();
    form.bind(el);
    expect(form.valid).toBe(valid);
  });

  it('removes ids of error slots that left the form from aria-describedby', async () => {
    const el = mount('<form><input name="email" required><div class="slot"></div></form>');
    createForm().bind(el);
    const input = el.querySelector('input')!;
    for (let i = 0; i < 3; i++) {
      el.querySelector('.slot')!.innerHTML = '<p data-formidate-error="email"></p>'; // re-rendered slot
      await tick();
    }
    const id = el.querySelector('p')!.id;
    expect(input.getAttribute('aria-describedby')).toBe(id);
  });

  it('never hides live-region slots, so screen readers announce the error', () => {
    const el = mount(
      '<form><input name="email" required><p data-formidate-error="email" aria-live="polite"></p></form>',
    );
    const form = createForm();
    form.bind(el);
    const p = el.querySelector('p')!;
    expect(p.hidden).toBe(false);
    form.touch();
    expect(p.textContent).not.toBe('');
    expect(p.hidden).toBe(false);
  });

  it('dirty ignores object key order', () => {
    const el = mount('<form><input name="address.city"><input name="address.zip"></form>');
    const form = createForm();
    form.bind(el);
    form.reset({ address: { zip: '1', city: 'x' } } as never);
    const city = el.querySelector<HTMLInputElement>('[name="address.city"]')!;
    type(city, 'y');
    type(city, 'x');
    expect(form.dirty).toBe(false);
  });

  it('stops debounced async rules on unbind', () => {
    vi.useFakeTimers();
    const check = vi.fn(async () => null);
    const el = mount('<form><input name="user"></form>');
    const form = createForm({ user: field().async(check, { debounce: 300 }) });
    form.bind(el);
    type(el.querySelector('input')!, 'naomi');
    form.unbind();
    vi.advanceTimersByTime(1000);
    expect(check).not.toHaveBeenCalled();
    expect(form.pending).toBe(false);
    vi.useRealTimers();
  });

  it('removeFields() while bound is consistent right away (inputs still present come back inferred)', () => {
    const el = mount('<form><input name="a" required></form>');
    const form = createForm({ a: field().label('A') });
    form.bind(el);
    form.removeFields('a');
    expect(form.controls.a?.label).not.toBe('A'); // inferred again, from the input still in the page
    expect(form.valid).toBe(false);
  });

  it('a container slot shows only errors of inputs the user has left', () => {
    const el = mount(`<form>
      <input name="address.city"><input name="address.zip" required>
      <p data-formidate-error="address"></p>
    </form>`);
    const form = createForm();
    form.bind(el);
    blur(el.querySelector<HTMLInputElement>('[name="address.city"]')!);
    expect(el.querySelector('p')!.textContent).toBe('');
    blur(el.querySelector<HTMLInputElement>('[name="address.zip"]')!);
    expect(el.querySelector('p')!.textContent).not.toBe('');
  });

  it('generated slot ids skip ids already in the page', () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<span id="formidate-error-1"></span><span id="formidate-error-2"></span>',
    );
    const el = mount('<form><input name="a"><p data-formidate-error="a"></p></form>');
    createForm().bind(el);
    expect(document.querySelectorAll(`#${el.querySelector('p')!.id}`)).toHaveLength(1);
  });
});

describe('gaps closed before beta', () => {
  const later = () => {
    let resolve!: (v: string | null) => void;
    const check = vi.fn(() => new Promise<string | null>((r) => (resolve = r)));
    return { check, settle: (v: string | null) => resolve(v) };
  };

  it('a native submit blocked only by a pending async check goes through once it passes', async () => {
    const el = mount('<form><input name="u" value="naomi"><button>Go</button></form>');
    const { check, settle } = later();
    const form = createForm({ u: field().async(check) });
    form.bind(el);
    const submits = vi.fn((e: Event) => e.defaultPrevented);
    el.addEventListener('submit', submits);
    el.requestSubmit(el.querySelector('button'));
    expect(submits).toHaveLastReturnedWith(true); // cancelled while pending
    settle(null);
    await tick();
    expect(submits).toHaveBeenCalledTimes(2);
    expect(submits).toHaveLastReturnedWith(false); // the retry is allowed through
    expect((submits.mock.calls[1]![0] as SubmitEvent).submitter).toBe(el.querySelector('button'));
  });

  it('does not resubmit when the async check fails', async () => {
    const el = mount('<form><input name="u" value="naomi"></form>');
    const { check, settle } = later();
    createForm({ u: field().async(check) }).bind(el);
    const submits = vi.fn();
    el.addEventListener('submit', submits);
    el.requestSubmit();
    settle('taken');
    await tick();
    expect(submits).toHaveBeenCalledTimes(1);
    expect(el.querySelector('input')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('does not resubmit when handleSubmit handles the same submit (no double submit)', async () => {
    const el = mount('<form><input name="u" value="naomi"></form>');
    const { check, settle } = later();
    const form = createForm({ u: field().async(check) });
    form.bind(el);
    const onValid = vi.fn();
    // Registered after bind (like React's delegated onSubmit), so the gate sees the event first.
    el.addEventListener('submit', form.handleSubmit(onValid));
    el.requestSubmit();
    settle(null);
    await tick();
    await tick();
    expect(onValid).toHaveBeenCalledTimes(1);
  });

  it('only the last of several blocked submits retries, and not after unbind', async () => {
    const el = mount('<form><input name="u" value="naomi"></form>');
    const { check, settle } = later();
    const form = createForm({ u: field().async(check) });
    form.bind(el);
    const submits = vi.fn();
    el.addEventListener('submit', submits);
    el.requestSubmit();
    el.requestSubmit();
    settle(null);
    await tick();
    expect(submits).toHaveBeenCalledTimes(3);

    const el2 = mount('<form><input name="u" value="sam"></form>');
    const second = later();
    const form2 = createForm({ u: field().async(second.check) });
    form2.bind(el2);
    const submits2 = vi.fn();
    el2.addEventListener('submit', submits2);
    el2.requestSubmit();
    form2.unbind();
    second.settle(null);
    await tick();
    expect(submits2).toHaveBeenCalledTimes(1);
  });

  it('reads labels from aria-labelledby, and group labels from a role="radiogroup" container', () => {
    const el = mount(`<form>
      <span id="l1">Work</span><span id="l2">email</span>
      <input name="a" required aria-labelledby="l1 missing l2">
      <h3 id="size">Size:</h3>
      <div role="radiogroup" aria-labelledby="size">
        <input type="radio" name="s" value="S" required><input type="radio" name="s" value="M">
      </div>
      <label for="b">Phone</label><input id="b" name="b" required aria-label="ignored">
    </form>`);
    const form = createForm();
    form.bind(el);
    expect(form.controls.a?.label).toBe('Work email');
    expect(form.controls.s?.label).toBe('Size');
    expect(form.controls.b?.label).toBe('Phone'); // <label> still wins
  });

  it('mixing a[0] and a[k] builds an object, like qs and PHP', () => {
    const el = mount('<form><input name="a[0]" value="x"><input name="a[k]" value="y"></form>');
    const form = createForm();
    form.bind(el);
    expect(form.values.a).toEqual({ 0: 'x', k: 'y' });
    form.setValue('a', { 0: 'p', k: 'q' });
    expect([...el.querySelectorAll('input')].map((i) => i.value)).toEqual(['p', 'q']);
  });

  it.each([
    ['time', 'min="09:00" max="17:30"', '08:59', '17:31', '12:00'],
    ['month', 'min="2024-01" max="2024-12"', '2023-12', '2025-01', '2024-06'],
    ['week', 'min="2024-W02" max="2024-W50"', '2024-W01', '2024-W51', '2024-W10'],
  ])('checks min/max on type="%s"', (t, attrs, low, high, ok) => {
    const el = mount(`<form><input name="x" type="${t}" ${attrs}></form>`);
    const form = createForm();
    form.bind(el);
    const input = el.querySelector('input')!;
    type(input, low);
    expect(form.controls.x?.error).toMatch(/on or after/);
    type(input, high);
    expect(form.controls.x?.error).toMatch(/on or before/);
    type(input, ok);
    expect(form.controls.x?.valid).toBe(true);
  });

  it('ignores an unparsable or overnight time range, as browsers do', () => {
    const el = mount(`<form>
      <input name="a" type="time" min="9am"><input name="b" type="time" min="22:00" max="06:00">
    </form>`);
    const form = createForm();
    form.bind(el);
    type(el.querySelector<HTMLInputElement>('[name="a"]')!, '08:00');
    type(el.querySelector<HTMLInputElement>('[name="b"]')!, '23:00');
    expect(form.valid).toBe(true);
  });
});

describe('pointer-held blur', () => {
  const press = (el: Element, type: 'pointerdown' | 'pointerup' | 'pointercancel') =>
    el.dispatchEvent(new Event(type, { bubbles: true }));

  it('waits for the pointer release before revealing an error (so the click lands on Submit)', async () => {
    const el = mount(
      '<form><input name="a" required><p data-formidate-error="a"></p><button>Go</button></form>',
    );
    createForm().bind(el);
    const input = el.querySelector('input')!;
    press(el.querySelector('button')!, 'pointerdown');
    blur(input);
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(el.querySelector('p')!.hidden).toBe(true);
    press(el.querySelector('button')!, 'pointerup');
    expect(input.getAttribute('aria-invalid')).toBeNull(); // still inside the click
    await tick();
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('releases on pointercancel, and a stale release does not end a newer press', async () => {
    const el = mount('<form><input name="a" required><input name="b" required></form>');
    createForm().bind(el);
    const [a, b] = el.querySelectorAll('input');
    press(a!, 'pointerdown');
    blur(a!);
    press(document.body, 'pointercancel');
    await tick();
    expect(a!.getAttribute('aria-invalid')).toBe('true');
    press(b!, 'pointerdown');
    blur(b!);
    press(document.body, 'pointercancel'); // the first press's leftover listener
    await tick();
    press(document.body, 'pointerup');
    await tick();
    expect(b!.getAttribute('aria-invalid')).toBe('true');
  });

  it('a blur without a pointer press (keyboard) shows errors immediately', () => {
    const el = mount('<form><input name="a" required></form>');
    createForm().bind(el);
    blur(el.querySelector('input')!);
    expect(el.querySelector('input')!.getAttribute('aria-invalid')).toBe('true');
  });
});
