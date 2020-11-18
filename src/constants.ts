import validateJs from 'validate.js';
import { IFormidateOptions, IFormValuesMap, IValidateJS } from './models/models';

export const customAsyncTasks: any = {};
export const ASYNC_RESET_INDICATOR = '___ASYNC_RESET_INDICATOR_UNIQUE_STRING___';

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
    // function to reject async validation if another vaidation is reques is received based on user interaction
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

// ===========
