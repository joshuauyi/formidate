import { describe, expect, it } from 'vitest';
import * as api from './index';

describe('public API', () => {
  it('exposes only named exports', () => {
    expect(Object.keys(api).sort()).toEqual([
      'DEFAULT_MESSAGES',
      'Field',
      'Form',
      'configure',
      'createForm',
      'field',
    ]);
    expect('default' in api).toBe(false);
  });

  it('has no global side effects', () => {
    expect('Formidate' in window).toBe(false);
  });

  it('createForm and field work together', () => {
    const form = api.createForm({ a: api.field().required() });
    expect(form).toBeInstanceOf(api.Form);
    expect(api.field()).toBeInstanceOf(api.Field);
  });
});
