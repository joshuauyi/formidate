import validateJs from 'validate.js';
import { IFormidateOptions, IFormValuesMap, IValidateJS } from './models/models';

export const customAsyncTasks: any = {};
export const ASYNC_RESET_INDICATOR = { key: 'ASYNC_RESET_INDICATOR' };

/* setup validate.js */

export const validate: IValidateJS = validateJs;
validate.Promise = Promise;

validate.validators.custom = (value: string, options: any, key: string, attributes: IFormValuesMap) => {
  if (!options) {
    return null;
  }

  if (typeof options !== 'object') {
    options = { message: options };
  }

  return options.message || null;
};

validate.validators.customAsync = (
  value: any,
  options: any,
  key: string,
  attributes: IFormValuesMap,
  globalOptions: IFormidateOptions,
) => {
  if (globalOptions.syncValidateOnly === true) {
    return null;
  }

  const asyncFuncKey = key + globalOptions.instanceCount;

  // triggers a call the reject the previous async promise carrying a validation
  // this is in turn handled by form validator to indicate the control is still loading
  if (customAsyncTasks[asyncFuncKey]) {
    customAsyncTasks[asyncFuncKey]();
    delete customAsyncTasks[asyncFuncKey];
  }

  return new validate.Promise((resolve: any, reject: any) => {
    // function to reject async validation if another vaidation is request is received based on user interaction
    customAsyncTasks[asyncFuncKey] = () => {
      reject(ASYNC_RESET_INDICATOR);
    };

    if (typeof options === 'function') {
      options(resolve);
    } else {
      resolve(options);
    }
  });
};

// Override error messages
validate.validators.equality.message = 'is not same as %{attribute}';

const pad2D = (num: number) => (num < 10 ? '0' : '') + num;
validate.extend(validate.validators.datetime, {
  // The value is guaranteed not to be null or undefined but otherwise it
  // could be anything.
  parse: (value: string, options: any) => Date.parse(value),
  // Input is a unix timestamp
  format: (value: string, options: any) => {
    const date = new Date(value);
    const dateStr = `${date.getFullYear()}-${pad2D(date.getMonth() + 1)}-${pad2D(date.getDate())}`;
    return options.dateOnly
      ? dateStr
      : dateStr + ' ' + `${pad2D(date.getHours())}:${pad2D(date.getMinutes())}:${pad2D(date.getSeconds())}`;
  },
});

// ===========
