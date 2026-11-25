// The built-in rules behave like Zod 4 (the most used schema library) on the same input strings.
// Deliberate differences are listed in `differs` with the reason.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { field } from './field';
import { createForm } from './form';
import type { AnyField } from './types';

const formidate = (f: AnyField) => (value: string) => {
  const form = createForm({ x: f });
  form.setValue('x', value as never);
  return form.controls.x.errors.length === 0;
};
const zod = (schema: z.ZodType) => (value: string) => schema.safeParse(value).success;

interface Case {
  rule: string;
  ours: (value: string) => boolean;
  theirs: (value: string) => boolean;
  inputs: string[];
  /** input → our expected result, where we intentionally differ from Zod. */
  differs?: Record<string, { ours: boolean; why: string }>;
}

const cases: Case[] = [
  {
    rule: 'email() ~ z.email()',
    ours: formidate(field().email()),
    theirs: zod(z.email()),
    inputs: [
      'a@b.co',
      'A@B.COM',
      'a+tag@x.io',
      "o'neil@x.com",
      'first.last@sub.example.co.uk',
      'asdf@gmail',
      'a..b@x.com',
      '.a@x.com',
      'a.@x.com',
      'a!b@x.com',
      ' a@b.com ',
      'a@b.c',
      'a@x.xn--p1ai',
      'nope',
      '@b.co',
      'a@',
    ],
    differs: { 'a@b-.com': { ours: false, why: 'a domain label cannot end with "-"' } },
  },
  {
    rule: 'url() ~ z.httpUrl()',
    ours: formidate(field().url()),
    theirs: zod(z.httpUrl()),
    inputs: [
      'https://example.com',
      'http://sub.example.co.uk/a?b#c',
      ' https://x.com ',
      'https://google',
      'http://localhost:3000',
      'http://a.b',
      'ftp://example.com',
      'javascript:alert(1)',
      'mailto:a@b.co',
      'example.com',
      'https://ex ample.com',
      'https://192.168.0.1',
    ],
  },
  {
    rule: 'url({ protocols: [], allowLocal: true }) ~ z.url()',
    ours: formidate(field().url({ protocols: [], allowLocal: true })),
    theirs: zod(z.url()),
    inputs: [
      'https://google',
      'http://localhost:3000',
      'ftp://example.com',
      'mailto:a@b.co',
      'https://192.168.0.1',
      'example.com',
      'not a url',
    ],
  },
  {
    rule: 'number() ~ z.coerce.number()',
    ours: formidate(field().number()),
    theirs: zod(z.coerce.number()),
    inputs: ['12', '-1.5', '+3', '.5', '5.', '1e3', '2.5E-3', ' 12 ', 'Infinity', '1,5', '12abc', '--1'],
    differs: {
      '0x10': {
        ours: false,
        why: 'hex/binary/octal are not numbers in a form (a number input rejects them too)',
      },
      '0b11': { ours: false, why: 'same' },
    },
  },
  {
    rule: 'integer() ~ z.coerce.number().int()',
    ours: formidate(field().integer()),
    theirs: zod(z.coerce.number().int()),
    inputs: ['7', '-7', '+7', ' 7 ', '1.0', '1e3', '1.5', '1e-3', 'seven'],
    differs: { '0x10': { ours: false, why: 'hex is not a number in a form' } },
  },
  {
    rule: 'min(10) ~ z.coerce.number().min(10)',
    ours: formidate(field().min(10)),
    theirs: zod(z.coerce.number().min(10)),
    inputs: ['10', '10.5', '9.99', '1e2', 'abc'],
  },
  {
    rule: 'multipleOf(0.1) ~ z.coerce.number().multipleOf(0.1)',
    ours: formidate(field().multipleOf(0.1)),
    theirs: zod(z.coerce.number().multipleOf(0.1)),
    inputs: ['0.3', '0.7', '1', '0.35', '-0.2'],
  },
  {
    rule: 'date() ~ z.iso.date() | z.iso.datetime({ local, offset })',
    ours: formidate(field().date()),
    theirs: zod(z.union([z.iso.date(), z.iso.datetime({ local: true, offset: true })])),
    inputs: [
      '2024-05-31',
      '2024-02-29',
      '2023-02-29',
      '2024-02-30',
      '2024-13-01',
      '2024-5-31',
      ' 2024-05-31 ',
      '2024-05-31T14:30',
      '2024-05-31T14:30:05',
      '2024-05-31T14:30:05.123',
      '2024-05-31T14:30:05+02:00',
      '1',
      'March 7, 2024',
      '31/05/2024',
    ],
    differs: {
      '2024-05-31T14:30Z': {
        ours: true,
        why: 'valid ISO 8601; Zod requires seconds when an offset is given',
      },
      '2024-05-31 14:30': { ours: true, why: 'the space separator is valid ISO 8601 (RFC 3339)' },
    },
  },
  {
    rule: 'maxLength(3) ~ z.string().max(3)',
    ours: formidate(field().maxLength(3)),
    theirs: zod(z.string().max(3)),
    inputs: ['abc', 'abcd', 'é', '😀😀', '😀😀😀😀'],
  },
  {
    rule: 'length(2) ~ z.string().length(2)',
    ours: formidate(field().length(2)),
    theirs: zod(z.string().length(2)),
    inputs: ['ab', 'abc', '😀é'],
  },
  {
    rule: 'oneOf ~ z.enum',
    ours: formidate(field().oneOf(['a', 'b'])),
    theirs: zod(z.enum(['a', 'b'])),
    inputs: ['a', 'b', 'A', 'c', ' a'],
  },
  {
    rule: 'pattern(/\\d{3}/) ~ z.string().regex(/\\d{3}/) (unanchored, like Zod)',
    ours: formidate(field().pattern(/\d{3}/)),
    theirs: zod(z.string().regex(/\d{3}/)),
    inputs: ['123', 'a123b', '12'],
  },
];

describe.each(cases)('$rule', ({ ours, theirs, inputs, differs = {} }) => {
  it.each(inputs)('agrees with Zod on %j', (input) => {
    expect(ours(input)).toBe(theirs(input));
  });
  it.each(Object.entries(differs))('differs from Zod on %j on purpose', (input, { ours: expected }) => {
    expect(ours(input)).toBe(expected);
    expect(theirs(input)).toBe(!expected);
  });
});

describe('deliberate form semantics (documented in the guide)', () => {
  it('blank / whitespace-only input is empty: required fails, every other rule passes', () => {
    // Zod: z.string().min(1) accepts "   ". In a form, a value of only spaces is "nothing typed".
    expect(formidate(field().required())('   ')).toBe(false);
    expect(zod(z.string().min(1))('   ')).toBe(true);
    expect(formidate(field().email())('')).toBe(true); // optional unless required()
  });
});
