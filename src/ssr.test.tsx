// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createForm, field } from './index';
import { useForm } from './react/index';

afterEach(() => vi.useRealTimers());

function Signup() {
  const { ref, controls, values, valid } = useForm({
    email: field('a@b.co').required().email(),
    user: field('me').async(async () => null),
  });
  return (
    <form ref={ref}>
      <input name="email" defaultValue={values.email ?? ''} />
      <output>{`${valid}/${controls.user.pending}`}</output>
    </form>
  );
}

describe('server (no DOM)', () => {
  it('runs without browser globals', () => {
    expect(typeof document).toBe('undefined');
    expect(typeof window).toBe('undefined');
  });

  it('creates forms with default values and validation state', () => {
    const form = createForm({ email: field('a@b.co').required().email(), name: field().required() });
    const s = form.getState();
    expect(s.values).toEqual({ email: 'a@b.co', name: null });
    expect(s.controls.email.valid).toBe(true);
    expect(s.controls.name.invalid).toBe(true);
    expect(s.controls.name.touched).toBe(false);
    expect(form.getState()).toBe(s);
  });

  it('starts no async rule, timer or request on creation', () => {
    vi.useFakeTimers();
    const check = vi.fn(async () => null);
    const form = createForm({
      user: field('taken').async(check, { debounce: 300 }),
      other: field('x').async(check),
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(check).not.toHaveBeenCalled();
    expect(form.getState().controls.user.pending).toBe(true);
  });

  it('validates on the server, async rules included', async () => {
    const form = createForm({
      email: field().required().email(),
      user: field().async(async (v) => (v === 'taken' ? 'Taken' : null), { debounce: 300 }),
    });
    form.setValues({ email: 'a@b.co', user: 'taken' });
    expect(await form.validate()).toBe(false);
    expect(form.getState().controls.user.error).toBe('Taken');
    form.setValue('user', 'free');
    expect(await form.validate()).toBe(true);
    const save = vi.fn();
    await form.handleSubmit(save)();
    expect(save).toHaveBeenCalledWith({ email: 'a@b.co', user: 'free' }, undefined);
  });

  it('renders useForm to HTML with the default values', () => {
    const html = renderToString(<Signup />);
    expect(html).toContain('value="a@b.co"');
    expect(html).toContain('<output>false/true</output>');
  });
});
