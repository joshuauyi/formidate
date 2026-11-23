import { act } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { field } from '../field';
import { useForm } from './index';

function Signup() {
  const { ref, controls, valid } = useForm({ email: field().label('Email').required().email() });
  return (
    <form ref={ref}>
      <input name="email" aria-label="email" />
      <p>{controls.email.touched ? controls.email.error : ''}</p>
      <output>{valid ? 'valid' : 'invalid'}</output>
    </form>
  );
}

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

async function hydrate(beforeHydrate?: (container: HTMLElement) => void) {
  const container = document.createElement('div');
  container.innerHTML = renderToString(<Signup />);
  document.body.append(container);
  beforeHydrate?.(container);
  const onRecoverableError = vi.fn();
  const consoleError = vi.spyOn(console, 'error');
  await act(async () => {
    root = hydrateRoot(container, <Signup />, { onRecoverableError });
  });
  expect(onRecoverableError).not.toHaveBeenCalled();
  expect(consoleError).not.toHaveBeenCalled();
  return container;
}

it('hydrates server markup without mismatches and binds afterwards', async () => {
  const container = await hydrate();
  const input = container.querySelector('input')!;
  expect(container.querySelector('form')!.noValidate).toBe(true);
  await act(async () => {
    input.value = 'nope';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
  expect(container.querySelector('p')!.textContent).toBe('Email must be a valid email address');
  expect(input.getAttribute('aria-invalid')).toBe('true');
});

it('keeps what the user typed before hydration', async () => {
  const container = await hydrate((c) => {
    c.querySelector('input')!.value = 'early@b.co';
  });
  expect(container.querySelector('output')!.textContent).toBe('valid');
});
