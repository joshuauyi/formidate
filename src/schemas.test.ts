// Compatibility: every Standard Schema library works the same way — no adapters.
// Yup's Standard Schema `validate` is always async, so tests await `form.validate()`.
import { type } from 'arktype';
import * as v from 'valibot';
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as yup from 'yup';
import { z } from 'zod';
import { createForm, field } from './index';
import type { StandardSchemaV1 } from './standard-schema';

interface Case {
  name: string;
  /** required string, at least 3 characters */
  handle: StandardSchemaV1;
  /** optional (nullable) email */
  email: StandardSchemaV1;
  /** string input coerced to a number >= 18 */
  age: StandardSchemaV1;
}

const cases: Case[] = [
  {
    name: 'Zod 4',
    handle: z.string({ error: 'Handle is required' }).min(3, 'Too short'),
    email: z.email('Bad email').nullable(),
    age: z.coerce.number().min(18, 'Too young'),
  },
  {
    name: 'Valibot',
    handle: v.pipe(v.string('Handle is required'), v.minLength(3, 'Too short')),
    email: v.nullable(v.pipe(v.string(), v.email('Bad email'))),
    age: v.pipe(v.string(), v.transform(Number), v.minValue(18, 'Too young')),
  },
  {
    name: 'Yup',
    handle: yup.string().required('Handle is required').min(3, 'Too short'),
    email: yup.string().email('Bad email').nullable(),
    age: yup.number().typeError('Too young').min(18, 'Too young'),
  },
  {
    name: 'ArkType',
    handle: type('string >= 3').configure({ message: 'Too short' }),
    email: type('string.email | null').configure({ message: 'Bad email' }),
    // the message belongs to the check that fails: the piped number constraint
    age: type('string.numeric.parse').pipe(type('number >= 18').configure({ message: 'Too young' })),
  },
];

describe.each(cases)('$name', ({ handle, email, age }) => {
  it('reports schema issues as control errors', async () => {
    const form = createForm({ handle, email, age });
    form.setValues({ handle: 'ab', email: 'nope', age: '12' });
    await form.validate();
    expect(form.controls.handle.errors).toEqual(['Too short']);
    expect(form.controls.email.errors).toEqual(['Bad email']);
    expect(form.controls.age.errors).toEqual(['Too young']);
    expect(form.valid).toBe(false);
  });

  it('treats a blank input (null) as missing and a nullable schema as optional', async () => {
    const form = createForm({ handle, email });
    await form.validate();
    expect(form.controls.handle.invalid).toBe(true);
    expect(form.controls.email.valid).toBe(true);
  });

  it('submits the schema output (coerced number)', async () => {
    const form = createForm({ handle, email, age });
    form.setValues({ handle: 'neo', age: '30' });
    let out: Record<string, unknown> | undefined;
    await form.handleSubmit((values) => {
      out = values;
    })();
    expect(out).toEqual({ handle: 'neo', email: null, age: 30 });
  });

  it('works through field().schema() together with chained rules', async () => {
    const form = createForm({
      h: field()
        .label('Handle')
        .schema(handle)
        .custom((x) => (x === 'root' ? 'Reserved' : null)),
    });
    form.setValue('h', 'root');
    await form.validate();
    expect(form.controls.h.errors).toEqual(['Reserved']);
  });
});

describe('output types are inferred from each library', () => {
  it('infers Yup, Valibot, ArkType and Zod outputs', () => {
    const form = createForm({
      zod: z.coerce.number(),
      valibot: v.pipe(v.string(), v.transform(Number)),
      yup: yup.number().required(),
      ark: type('string.numeric.parse'),
    });
    void form.handleSubmit((values) => {
      expectTypeOf(values.zod).toEqualTypeOf<number>();
      expectTypeOf(values.valibot).toEqualTypeOf<number>();
      expectTypeOf(values.yup).toEqualTypeOf<number>();
      expectTypeOf(values.ark).toEqualTypeOf<number>();
    });
  });
});
