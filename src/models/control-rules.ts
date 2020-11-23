import { IFormValuesMap } from './models';

type ErrorMsgFunc = (value: string, options: any, key: string, attributes: IFormValuesMap) => string | null;
export type ErroMessageType = string | ErrorMsgFunc | null | undefined;

export interface IDateRule {
  dateOnly?: boolean;
  earliet?: any;
  latest?: any;
  notValid?: ErroMessageType;
  tooEarly?: ErroMessageType;
  tooLate?: ErroMessageType;
  message?: ErroMessageType;
}

export interface IEmailMainRule {
  message: ErroMessageType;
}

export type EmailRule = boolean | IEmailMainRule;

export type EqualityRule =
  | string
  | { attribute: string; message?: ErroMessageType; comparator?: (v1: any, v2: any) => any };

export type ExclusionMainRule = any[] | { [key: string]: any };
export type ExclusionRule = ExclusionMainRule | { within: ExclusionMainRule; message?: ErroMessageType };

export interface IFormatMainRule {
  pattern: string;
  flags?: string;
  message?: ErroMessageType;
}
export type FormatRule = string | IFormatMainRule;

export type InclusionMainRule = any[] | { [key: string]: any };
export type InclusionRule = InclusionMainRule | { within: InclusionMainRule; message?: ErroMessageType };

export interface ILengthRule {
  is?: number;
  minimum?: number;
  maximum?: number;
  wrongLength?: ErroMessageType;
  notValid?: ErroMessageType;
  tooLong?: ErroMessageType;
  tooShort?: ErroMessageType;
  message?: ErroMessageType;
}

export interface INumericalityRule {
  onlyInteger?: boolean;
  strict?: boolean;
  greaterThan?: number;
  greaterThanOrEqualTo?: number;
  equalTo?: number;
  lessThanOrEqualTo?: number;
  lessThan?: number;
  divisibleBy?: number;
  odd?: boolean;
  even?: boolean;

  notValid?: ErroMessageType;
  notInteger?: ErroMessageType;
  notGreaterThan?: ErroMessageType;
  notGreaterThanOrEqualTo?: ErroMessageType;
  notEqualTo?: ErroMessageType;
  notLessThan?: ErroMessageType;
  notLessThanOrEqualTo?: ErroMessageType;
  notDivisibleBy?: ErroMessageType;
  notOdd?: ErroMessageType;
  notEven?: ErroMessageType;
  message?: ErroMessageType;
}

export interface IPresenceRule {
  allowEmpty?: boolean;
  message?: ErroMessageType;
}

export type TypeRule = string | { type: string; message?: ErroMessageType };

export interface IURLMainRule {
  message?: ErroMessageType;
  schemes?: string[];
  allowLocal?: boolean;
  allowDataUrl?: boolean;
}

export type IURLRule = boolean | IURLMainRule;

export type CustomRule = (value: string, values: IFormValuesMap, controlName: string) => string | null;

export type CustomAsyncRule = (
  value: string,
  values: IFormValuesMap,
  controlName: string,
) => (resolve: (value?: string) => any) => any;

export interface IFormRuleItem {
  datetime?: IDateRule;
  email?: EmailRule;
  equality?: EqualityRule;
  exclusion?: ExclusionRule;
  format?: FormatRule;
  inclusion?: InclusionRule;
  length?: ILengthRule;
  numericality?: INumericalityRule;
  presence?: IPresenceRule;
  type?: TypeRule;
  url?: IURLRule;
  custom?: CustomRule;
  customAsync?: CustomAsyncRule;
}
