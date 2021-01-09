import { AsyncValidateOption, ValidateJS, ValidateOption } from 'validate.js';
import Constrain from '../Constrain';
import FormControl from '../FormControl';
import { IFormRuleItem } from './control-rules';

export interface IFormControlsMap {
  [key: string]: FormControl;
}
export interface IConstrainsMap {
  [key: string]: Constrain;
}

export interface IFormValuesMap {
  [key: string]: string | null;
}

export interface IFormRules {
  [key: string]: IFormRuleItem;
}

export interface IRawFormRules {
  [key: string]: Constrain;
}

interface ICustomValidateOption {
  instanceCount?: number;
}

export type IFormidateOptions = ValidateOption & AsyncValidateOption & ICustomValidateOption;

export interface IValidateJS extends ValidateJS {
  Promise?: any;
}

export type IValidationCallback = ((valid: boolean, controls: IFormControlsMap) => void) | null;

export type AllowedEvents = Array<'input' | 'focus' | 'blur'>;

export interface IDetailedError {
  attribute: string;
  value: string;
  validator: string;
  globalOptions: IFormidateOptions;
  attributes: IFormValuesMap;
  options: any;
  error: string;
}

export interface IMappedErrors {
  [key: string]: { [key: string]: string };
}
