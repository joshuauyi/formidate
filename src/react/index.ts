import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { createForm, Form } from '../form';
import type { DynamicFields, FieldsMap, FormOptions, FormState } from '../types';

export interface UseFormResult<F extends FieldsMap> extends FormState<F> {
  /** The underlying form — `form.setValue()`, `form.reset()`, `form.disable()`, … */
  form: Form<F>;
  /** Callback ref for your `<form>`: binds on mount, unbinds on unmount. */
  ref: (element: HTMLElement | null) => void;
  /** `form.handleSubmit` — use as `<form onSubmit={handleSubmit(save)}>`. */
  handleSubmit: Form<F>['handleSubmit'];
}

/**
 * Use a Formidate form in a React component. The form is created once; the component re-renders
 * with an immutable snapshot whenever its state changes.
 *
 * @example
 * const { ref, handleSubmit, controls } = useForm({ email: field().required().email() });
 * return (
 *   <form ref={ref} onSubmit={handleSubmit(save)}>
 *     <input name="email" />
 *     {controls.email.touched && controls.email.error}
 *   </form>
 * );
 */
export function useForm<F extends FieldsMap = DynamicFields>(
  fields?: F | Form<F>,
  options?: FormOptions,
): UseFormResult<F> {
  const [form] = useState<Form<F>>(() => (fields instanceof Form ? fields : createForm(fields, options)));
  const state = useSyncExternalStore(form.subscribe, form.getState, form.getState);
  const ref = useCallback(
    (element: HTMLElement | null) => {
      if (element) form.bind(element);
      else form.unbind();
    },
    [form],
  );
  return useMemo(() => ({ ...state, form, ref, handleSubmit: form.handleSubmit }), [state, form, ref]);
}
