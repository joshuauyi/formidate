import { IFormValuesMap } from './models';

export type EqualityRule = string | { attribute: string; message?: string; comparator?: (v1: any, v2: any) => any };

export type ExclusionMainRule = any[] | { [key: string]: any };
export type ExclusionRule = ExclusionMainRule | { within: ExclusionMainRule; message?: string };

export interface IFormatMainRule {
  pattern: string;
  flags?: string;
  message?: string;
}
export type FormatRule = string | IFormatMainRule;

export type InclusionMainRule = any[] | { [key: string]: any };
export type InclusionRule = InclusionMainRule | { within: InclusionMainRule; message?: string };

export interface ILengthRule {
  is?: number;
  minimum?: number;
  maximum?: number;
  notValid?: string;
  tooLong?: string;
  tooShort?: string;
  wrongLength?: string;
  message?: string;
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

  notValid?: string;
  notInteger?: string;
  notGreaterThan?: string;
  notGreaterThanOrEqualTo?: string;
  notEqualTo?: string;
  notLessThan?: string;
  notLessThanOrEqualTo?: string;
  notDivisibleBy?: string;
  notOdd?: string;
  notEven?: string;
  message?: string;
}

export interface IPresenceRule {
  allowEmpty?: boolean;
  message?: string;
}

export type TypeRule = string | { type: string; message?: string };

export interface IURLMainRule {
  message?: string;
  schemes?: string[];
  allowLocal?: boolean;
  allowDataUrl?: boolean;
}

export type IURLRule = boolean | IURLMainRule;

export type CustomRule = (value: string, attributes: IFormValuesMap, attributeName: string) => string | null;

export type CustomAsyncRule = (
  value: string,
  attributes: IFormValuesMap,
  attributeName: string,
) => (resolve: (value?: string) => any) => any;

export interface IFormRuleItem {
  date?: any;
  datetime?: any;
  email?: boolean | { message: string };
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
