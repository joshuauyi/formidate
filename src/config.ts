import type { FormOptions, Message, MessageContext, Messages } from './types';

export const DEFAULT_MESSAGES: Messages = {
  required: '{label} is required',
  email: '{label} must be a valid email address',
  url: '{label} must be a valid URL',
  pattern: '{label} is not in the expected format',
  length: '{label} must be exactly {length:character}',
  minLength: '{label} must be at least {min:character}',
  maxLength: '{label} must be at most {max:character}',
  number: '{label} must be a number',
  integer: '{label} must be a whole number',
  min: '{label} must be at least {min}',
  max: '{label} must be at most {max}',
  greaterThan: '{label} must be greater than {limit}',
  lessThan: '{label} must be less than {limit}',
  multipleOf: '{label} must be a multiple of {step}',
  date: '{label} must be a valid date',
  minDate: '{label} must be on or after {min}',
  maxDate: '{label} must be on or before {max}',
  oneOf: '{label} must be one of: {values}',
  notOneOf: '{label} must not be {value}',
  minItems: '{label} must have at least {min:item}',
  maxItems: '{label} must have at most {max:item}',
  sameAs: '{label} must match {target}',
  async: '{label} could not be verified',
};

const globalOptions: FormOptions = {};

/**
 * Set global defaults for every form (messages, labels, DOM behaviour). Per-form options win.
 *
 * @example configure({ messages: { required: '{label} est obligatoire' } })
 */
export function configure(options: FormOptions): void {
  const messages = { ...globalOptions.messages, ...options.messages };
  Object.assign(globalOptions, options, { messages });
}

export type ResolvedOptions = Required<Omit<FormOptions, 'messages'>> & { messages: Messages };

export function resolveOptions(local: FormOptions = {}): ResolvedOptions {
  return {
    html: local.html ?? globalOptions.html ?? true,
    aria: local.aria ?? globalOptions.aria ?? true,
    focusOnError: local.focusOnError ?? globalOptions.focusOnError ?? true,
    fallbackLabel: local.fallbackLabel ?? globalOptions.fallbackLabel ?? 'This field',
    messages: { ...DEFAULT_MESSAGES, ...globalOptions.messages, ...local.messages },
  };
}

const stringify = (v: unknown): string =>
  v == null ? '' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v);

/**
 * Fill `{key}` placeholders from `ctx`. `{key:noun}` writes the count with a (naively) pluralized
 * noun: `{min:character}` → "1 character" / "8 characters".
 */
export function formatMessage(message: Message, ctx: MessageContext): string {
  if (typeof message === 'function') return message(ctx);
  return message.replace(/\{(\w+)(?::(\w+))?\}/g, (match, key: string, noun?: string) => {
    if (!(key in ctx)) return match;
    const value = stringify(ctx[key]);
    return noun ? `${value} ${value === '1' ? noun : `${noun}s`}` : value;
  });
}
