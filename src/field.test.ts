import { describe, expect, expectTypeOf, it } from 'vitest';
import { field } from './field';
import { createForm } from './form';
import type { AnyField, FieldValue, OutputOf } from './types';

/** Validate `value` against `f` and return its error messages. */
function errorsOf(f: AnyField, value: FieldValue): readonly string[] {
  const form = createForm({ x: f });
  form.setValue('x', value as never);
  return form.controls.x.errors;
}
const passes = (f: AnyField, value: FieldValue) => errorsOf(f, value).length === 0;

describe('field()', () => {
  it('has no rules by default and accepts anything', () => {
    expect(passes(field(), null)).toBe(true);
    expect(passes(field(), 'x')).toBe(true);
  });

  it('uses the default value as the initial value', () => {
    const form = createForm({ x: field('hi') });
    expect(form.values.x).toBe('hi');
  });

  it('treats a blank default as null', () => {
    expect(createForm({ x: field('  ') }).values.x).toBeNull();
  });
});

describe('empty values', () => {
  const rules: [string, AnyField][] = [
    ['email', field().email()],
    ['url', field().url()],
    ['pattern', field().pattern(/^a$/)],
    ['length', field().length(3)],
    ['minLength', field().minLength(3)],
    ['maxLength', field().maxLength(1)],
    ['number', field().number()],
    ['integer', field().integer()],
    ['min', field().min(5)],
    ['max', field().max(5)],
    ['greaterThan', field().greaterThan(5)],
    ['lessThan', field().lessThan(5)],
    ['multipleOf', field().multipleOf(5)],
    ['date', field().date()],
    ['minDate', field().minDate('2020-01-01')],
    ['maxDate', field().maxDate('2020-01-01')],
    ['oneOf', field().oneOf(['a'])],
    ['notOneOf', field().notOneOf(['a'])],
    ['maxItems', field().maxItems(0)],
  ];
  it.each(rules)('%s passes for null, empty string and []', (_, f) => {
    expect(passes(f, null)).toBe(true);
    expect(passes(f, '')).toBe(true);
    expect(passes(f, [])).toBe(true);
  });

  it('required fails for null, blank and []', () => {
    expect(errorsOf(field().required(), null)).toEqual(['This field is required']);
    expect(passes(field().required(), '   ')).toBe(false);
    expect(passes(field().array().required(), [])).toBe(false);
    expect(passes(field().required(), 'x')).toBe(true);
    expect(passes(field().array().required(), ['a'])).toBe(true);
  });

  it('required accepts object values', () => {
    expect(passes(field().required(), { a: 'x' })).toBe(true);
  });
});

describe('string rules', () => {
  it('email({ allowLocal: true }) accepts dotless hosts like browsers do', () => {
    const f = field().email({ allowLocal: true }, 'Bad email');
    for (const ok of ['me@localhost', 'asdf@gmail', 'a@b.co']) expect(passes(f, ok), ok).toBe(true);
    for (const bad of ['nope', 'a b@c', 'a@-b']) expect(passes(f, bad), bad).toBe(false);
    expect(errorsOf(f, 'nope')).toEqual(['Bad email']);
  });

  it('email keeps the message-only form', () => {
    expect(errorsOf(field().email('Enter an email'), 'x')).toEqual(['Enter an email']);
    expect(
      errorsOf(
        field().email(({ label }) => `${label}?`),
        'x',
      ),
    ).toEqual(['This field?']);
  });

  it('url defaults to http/https', () => {
    const f = field().url();
    expect(passes(f, 'https://x.dev/a?b')).toBe(true);
    expect(passes(f, 'http://localhost:3000')).toBe(false); // needs a real host unless allowLocal
    expect(passes(f, 'ftp://x.dev')).toBe(false);
    expect(passes(f, 'not a url')).toBe(false);
  });

  it('url protocols can be restricted or opened up', () => {
    expect(passes(field().url({ protocols: ['ftp'] }), 'ftp://x.dev')).toBe(true);
    expect(passes(field().url({ protocols: ['ftp'] }), 'https://x.dev')).toBe(false);
    expect(passes(field().url({ protocols: [] }), 'mailto:a@b.c')).toBe(true);
  });

  it('pattern tests the regexp and resets lastIndex for global regexps', () => {
    const f = field().pattern(/\d{3}/g);
    expect(passes(f, '123')).toBe(true);
    expect(passes(f, '123')).toBe(true);
    expect(passes(f, 'ab')).toBe(false);
    expect(errorsOf(f, 'ab')).toEqual(['This field is not in the expected format']);
  });

  it('length / minLength / maxLength', () => {
    expect(passes(field().length(3), 'abc')).toBe(true);
    expect(errorsOf(field().length(3), 'ab')).toEqual(['This field must be exactly 3 characters']);
    expect(errorsOf(field().minLength(3), 'ab')).toEqual(['This field must be at least 3 characters']);
    expect(passes(field().minLength(3), 'abc')).toBe(true);
    expect(errorsOf(field().maxLength(2), 'abc')).toEqual(['This field must be at most 2 characters']);
    expect(passes(field().maxLength(3), 'abc')).toBe(true);
  });
});

describe('number rules', () => {
  it('number is strict', () => {
    const f = field().number();
    for (const ok of ['12', '-1.5', '1e3', '0']) expect(passes(f, ok)).toBe(true);
    for (const bad of ['12abc', 'abc', 'Infinity']) expect(passes(f, bad)).toBe(false);
    expect(errorsOf(f, 'x')).toEqual(['This field must be a number']);
  });

  it('integer', () => {
    expect(passes(field().integer(), '4')).toBe(true);
    expect(passes(field().integer(), '4.5')).toBe(false);
    expect(errorsOf(field().integer(), 'x')).toEqual(['This field must be a whole number']);
  });

  it('min / max are inclusive, greaterThan / lessThan exclusive', () => {
    expect(passes(field().min(5), '5')).toBe(true);
    expect(errorsOf(field().min(5), '4')).toEqual(['This field must be at least 5']);
    expect(passes(field().min(5), 'abc')).toBe(false);
    expect(passes(field().max(5), '5')).toBe(true);
    expect(errorsOf(field().max(5), '6')).toEqual(['This field must be at most 5']);
    expect(passes(field().greaterThan(5), '5')).toBe(false);
    expect(errorsOf(field().greaterThan(5), '5')).toEqual(['This field must be greater than 5']);
    expect(passes(field().greaterThan(5), '6')).toBe(true);
    expect(passes(field().lessThan(5), '5')).toBe(false);
    expect(errorsOf(field().lessThan(5), '5')).toEqual(['This field must be less than 5']);
    expect(passes(field().lessThan(5), '4')).toBe(true);
  });

  it('multipleOf tolerates floating point', () => {
    expect(passes(field().multipleOf(0.1), '0.3')).toBe(true);
    expect(passes(field().multipleOf(3), '9')).toBe(true);
    expect(errorsOf(field().multipleOf(3), '10')).toEqual(['This field must be a multiple of 3']);
  });
});

describe('date rules', () => {
  it('date', () => {
    expect(passes(field().date(), '2024-02-29')).toBe(true);
    expect(errorsOf(field().date(), 'nope')).toEqual(['This field must be a valid date']);
  });

  it('minDate / maxDate are inclusive and accept strings or Dates', () => {
    expect(passes(field().minDate('2024-01-01'), '2024-01-01')).toBe(true);
    expect(errorsOf(field().minDate('2024-01-01'), '2023-12-31')).toEqual([
      'This field must be on or after 2024-01-01',
    ]);
    const limit = new Date(2024, 5, 30, 18, 0); // a local date-time: compared by local calendar day
    expect(passes(field().maxDate(limit), '2024-06-30')).toBe(true);
    expect(errorsOf(field().maxDate(limit), '2024-07-01')).toEqual([
      'This field must be on or before 2024-06-30',
    ]);
  });
});

describe('choice rules', () => {
  it('oneOf / notOneOf', () => {
    expect(passes(field().oneOf(['a', 'b']), 'a')).toBe(true);
    expect(errorsOf(field().oneOf(['a', 'b']), 'c')).toEqual(['This field must be one of: a, b']);
    expect(passes(field().notOneOf(['admin']), 'bob')).toBe(true);
    expect(errorsOf(field().notOneOf(['admin']), 'admin')).toEqual(['This field must not be admin']);
  });
});

describe('array fields', () => {
  it('array() defaults to [] or the given defaults', () => {
    expect(createForm({ x: field().array() }).values.x).toEqual([]);
    expect(createForm({ x: field().array(['a']) }).values.x).toEqual(['a']);
  });

  it('applies string rules to each element', () => {
    const f = field().array().email();
    expect(passes(f, ['a@b.co', 'c@d.co'])).toBe(true);
    expect(passes(f, ['a@b.co', 'nope'])).toBe(false);
    expect(passes(f, ['a@b.co', ''])).toBe(true);
  });

  it('minItems / maxItems count elements', () => {
    expect(errorsOf(field().array().minItems(2), ['a'])).toEqual(['This field must have at least 2 items']);
    expect(passes(field().array().minItems(2), ['a', 'b'])).toBe(true);
    expect(errorsOf(field().array().maxItems(1), ['a', 'b'])).toEqual([
      'This field must have at most 1 item',
    ]);
    expect(passes(field().minItems(1), 'scalar')).toBe(true);
    expect(passes(field().minItems(1), null)).toBe(false);
  });

  it('string rules ignore object values', () => {
    expect(passes(field().email(), { a: 'b' })).toBe(true);
  });
});

describe('immutability', () => {
  it('every method returns a new Field and never mutates the base', () => {
    const base = field().email();
    const strict = base.required();
    expect(strict).not.toBe(base);
    expect(passes(base, null)).toBe(true);
    expect(passes(strict, null)).toBe(false);
  });

  it('sharing a base field across forms is safe', () => {
    const base = field().minLength(2);
    const a = createForm({ x: base.custom(() => 'A') });
    const b = createForm({ x: base });
    b.setValue('x', 'abc');
    a.setValue('x', 'abc');
    expect(a.controls.x.errors).toEqual(['A']);
    expect(b.controls.x.errors).toEqual([]);
  });
});

describe('messages', () => {
  it('accepts a custom string message', () => {
    expect(errorsOf(field().required('Needed!'), null)).toEqual(['Needed!']);
  });

  it('interpolates templates with label, name, value and params', () => {
    const f = field().label('Code').minLength(4, '{label}/{name}: {value} < {min} ({missing})');
    expect(errorsOf(f, 'ab')).toEqual(['Code/x: ab < 4 ({missing})']);
  });

  it('joins array params', () => {
    expect(errorsOf(field().oneOf(['a', 'b'], 'pick {values}'), 'c')).toEqual(['pick a, b']);
  });

  it('accepts a message function', () => {
    const f = field().maxLength(2, (ctx) => `${ctx.label}:${String(ctx.max)}:${String(ctx.value)}`);
    expect(errorsOf(f, 'abc')).toEqual(['This field:2:abc']);
  });

  it('label() is used in default messages', () => {
    expect(errorsOf(field().label('Email').required(), null)).toEqual(['Email is required']);
  });

  it('collects every failing rule in order', () => {
    expect(errorsOf(field().minLength(5).email(), 'ab')).toEqual([
      'This field must be at least 5 characters',
      'This field must be a valid email address',
    ]);
  });
});

describe('types', () => {
  it('field() is string | null, required narrows the output', () => {
    expectTypeOf<OutputOf<ReturnType<typeof field>>>().toEqualTypeOf<string | null>();
    const r = field().required();
    expectTypeOf<OutputOf<typeof r>>().toEqualTypeOf<string>();
  });

  it('oneOf narrows the output to the given union', () => {
    const f = field().oneOf(['a', 'b']);
    expectTypeOf<OutputOf<typeof f>>().toEqualTypeOf<'a' | 'b' | null>();
    const g = field().required().oneOf(['a', 'b']);
    expectTypeOf<OutputOf<typeof g>>().toEqualTypeOf<'a' | 'b'>();
    const h = field().array().oneOf(['x', 'y']);
    expectTypeOf<OutputOf<typeof h>>().toEqualTypeOf<('x' | 'y')[]>();
  });

  it('array() is string[]', () => {
    const f = field().array();
    expectTypeOf<OutputOf<typeof f>>().toEqualTypeOf<string[]>();
  });

  it('custom receives the typed value', () => {
    field()
      .array()
      .custom((v) => {
        expectTypeOf(v).toEqualTypeOf<string[]>();
        return null;
      });
  });
});

describe('async rule typing', () => {
  it('receives a non-null value (async rules never run for empty values)', () => {
    field().async(async (value) => {
      expectTypeOf(value).toEqualTypeOf<string>();
      return null;
    });
    field()
      .array()
      .async(async (value) => {
        expectTypeOf(value).toEqualTypeOf<string[]>();
        return null;
      });
  });
});

describe('format rules: no lenient parsing', () => {
  it('minDate(new Date()) accepts today (date-only values compare by calendar day)', () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    expect(passes(field().minDate(now), day(now))).toBe(true);
    expect(passes(field().maxDate(now), day(now))).toBe(true);
    expect(passes(field().minDate(now), day(yesterday))).toBe(false);
    expect(errorsOf(field().minDate(now), day(yesterday))).toEqual([
      `This field must be on or after ${day(now)}`,
    ]);
  });

  it('date-times compare by time; a date-only limit compares a date-time by day', () => {
    expect(passes(field().minDate('2024-01-01T10:00'), '2024-01-01T09:59')).toBe(false);
    expect(passes(field().minDate('2024-01-01T10:00'), '2024-01-01T10:00')).toBe(true);
    expect(passes(field().maxDate('2024-01-31'), '2024-01-31T23:59')).toBe(true);
    expect(passes(field().minDate('2024-01-01'), 'nonsense')).toBe(false);
  });

  it('an invalid date limit throws when the field is defined', () => {
    expect(() => field().minDate('tomorrow')).toThrow('invalid date limit');
  });

  it('email({ multiple: true }) checks each comma-separated address', () => {
    const f = field().email({ multiple: true });
    expect(passes(f, 'a@b.com, c@d.org')).toBe(true);
    expect(passes(f, 'a@b.com,c@d')).toBe(false);
    expect(passes(f, 'a@b.com,')).toBe(false);
  });

  it('lengths count characters, not UTF-16 units', () => {
    expect(passes(field().maxLength(3), '😀😀')).toBe(true);
    expect(passes(field().length(2), '😀é')).toBe(true);
    expect(passes(field().minLength(3), '😀😀')).toBe(false);
  });
});

describe('default messages pluralize', () => {
  it('singular and plural counts', () => {
    expect(errorsOf(field().minLength(1), '')).toEqual([]);
    expect(errorsOf(field().length(1), 'ab')).toEqual(['This field must be exactly 1 character']);
    expect(errorsOf(field().maxLength(2), 'abc')).toEqual(['This field must be at most 2 characters']);
    expect(errorsOf(field().array().minItems(1), [])).toEqual(['This field must have at least 1 item']);
    expect(errorsOf(field().array().maxItems(2), ['a', 'b', 'c'])).toEqual([
      'This field must have at most 2 items',
    ]);
  });
});
