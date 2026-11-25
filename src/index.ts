/*!
 * Formidate — tiny, zero-dependency form validation for any framework (or none).
 * (c) 2019–2026 Joshua Uyi · MIT licensed
 */
export { configure, DEFAULT_MESSAGES } from './config';
export type { EmailOptions, UrlOptions } from './field';
export { Field, field } from './field';
export { createForm, Form } from './form';
export type { StandardSchemaV1 } from './standard-schema';
export type {
  AsyncRule,
  AsyncRuleContext,
  AsyncRuleOptions,
  ControlState,
  ControlStatus,
  CustomRule,
  DynamicFields,
  FieldsMap,
  FieldValue,
  FormOptions,
  FormOutput,
  FormState,
  FormValues,
  InvalidSubmitHandler,
  Issue,
  Listener,
  Message,
  MessageContext,
  Messages,
  OutputOf,
  PreventableEvent,
  RuleContext,
  RuleName,
  SubmitHandler,
  ValueOf,
  Values,
} from './types';
