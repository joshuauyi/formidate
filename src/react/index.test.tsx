import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { field } from '../field';
import { createForm, type Form } from '../form';
import type { DynamicFields } from '../types';
import { useForm } from './index';

afterEach(cleanup);

function Login({ onSave = () => {} }: { onSave?: (v: unknown) => void }) {
  const { ref, handleSubmit, controls, valid } = useForm({
    email: field().label('Email').required().email(),
  });
  return (
    <form ref={ref} onSubmit={handleSubmit(onSave)}>
      <input name="email" aria-label="email" />
      {controls.email.touched && <p role="alert">{controls.email.error}</p>}
      <output>{valid ? 'valid' : 'invalid'}</output>
      <button type="submit">go</button>
    </form>
  );
}

function Shared({ shared }: { shared: Form<{ name: ReturnType<typeof field> }> }) {
  const { values, form } = useForm(shared);
  return <p>{form === shared ? values.name : 'different form'}</p>;
}

const results: unknown[] = [];
function Recorder({ n }: { n: number }) {
  results.push(useForm({ a: field() }));
  return <p>{n}</p>;
}

function ZeroConfig() {
  const { ref, controls } = useForm();
  return (
    <form ref={ref}>
      <input name="q" required aria-label="q" />
      <p>{controls.q?.error ?? 'none'}</p>
    </form>
  );
}

function Bound({ form }: { form: Form<DynamicFields> }) {
  const { ref } = useForm(form);
  return (
    <form ref={ref}>
      <input name="a" aria-label="a" />
    </form>
  );
}

function Typed() {
  const { ref, values } = useForm({ a: field() });
  return (
    <form ref={ref}>
      <input name="a" aria-label="a" />
      <p>{values.a ?? 'empty'}</p>
    </form>
  );
}

describe('useForm', () => {
  it('renders the initial state and binds via ref', () => {
    const { container } = render(<Login />);
    expect(screen.getByText('invalid')).toBeTruthy();
    expect(container.querySelector('form')!.noValidate).toBe(true);
  });

  it('re-renders when the user types and blurs', () => {
    render(<Login />);
    const input = screen.getByLabelText('email');
    fireEvent.input(input, { target: { value: 'bad' } });
    fireEvent.blur(input);
    expect(screen.getByRole('alert').textContent).toBe('Email must be a valid email address');
    fireEvent.input(input, { target: { value: 'a@b.co' } });
    expect(screen.getByText('valid')).toBeTruthy();
  });

  it('handleSubmit calls the handler only when valid', async () => {
    const onSave = vi.fn();
    render(<Login onSave={onSave} />);
    const form = screen.getByText('go').closest('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Email is required');
    fireEvent.input(screen.getByLabelText('email'), { target: { value: 'a@b.co' } });
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(onSave).toHaveBeenCalledWith({ email: 'a@b.co' }, expect.anything());
  });

  it('accepts an existing Form', () => {
    const shared = createForm({ name: field('Ann') });
    render(<Shared shared={shared} />);
    expect(screen.getByText('Ann')).toBeTruthy();
    act(() => shared.setValue('name', 'Bob'));
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('returns a stable result between unrelated renders', () => {
    results.length = 0;
    const { rerender } = render(<Recorder n={1} />);
    rerender(<Recorder n={2} />);
    expect(results.at(-1)).toBe(results.at(-2));
  });

  it('works without fields (zero-config)', () => {
    render(<ZeroConfig />);
    expect(screen.getByText('q is required')).toBeTruthy(); // label from aria-label
  });

  it('unbinds on unmount', () => {
    const shared = createForm();
    const { container, unmount } = render(<Bound form={shared} />);
    const form = container.querySelector('form')!;
    const input = container.querySelector('input')!;
    unmount();
    expect(form.noValidate).toBe(false);
    input.value = 'after';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(shared.values.a).toBeNull();
  });

  it('survives StrictMode double mounting', () => {
    render(
      <StrictMode>
        <Typed />
      </StrictMode>,
    );
    fireEvent.input(screen.getByLabelText('a'), { target: { value: 'typed' } });
    expect(screen.getByText('typed')).toBeTruthy();
  });
});
