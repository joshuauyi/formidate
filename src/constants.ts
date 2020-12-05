import validateJs from 'validate.js';
import { IDetailedError, IFormidateOptions, IFormValuesMap, IMappedErrors, IValidateJS } from './models/models';

export const customAsyncTasks: any = {};
export const ASYNC_RESET_INDICATOR = { key: 'ASYNC_RESET_INDICATOR' };

/* setup validate.js */

export const validate: IValidateJS = validateJs;
validate.Promise = Promise;

validate.formatters.mapped = (errors: IDetailedError[]) => {
  return errors.reduce((mappedErrors: IMappedErrors, error) => {
    if (!mappedErrors[error.attribute]) {
      mappedErrors[error.attribute] = {};
    }
    mappedErrors[error.attribute][error.validator] = error.error;
    return mappedErrors;
  }, {});
};

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

    // options should always be a function which resolves the async validator
    options(resolve);
  });
};

// Override error messages
validate.validators.equality.message = 'is not same as %{attribute}';

const pad2D = (num: number) => (num < 10 ? '0' : '') + num;
validate.extend(validate.validators.datetime, {
  // The value is guaranteed not to be null or undefined but otherwise it
  // could be anything.
  parse: (value: string, options: any) => {
    if (value.length < 8) {
      return NaN; // date is too short to be valid
    }
    const dateHasTime = /\d{1,2}:\d{1,2}/.test(value);
    const d = new Date(value);
    if (!options.dateOnly && !dateHasTime) {
      // reset timezone offset, if full date and time was expected, but only date was set
      d.setTime(d.getTime() + d.getTimezoneOffset() * 60 * 1000);
    }
    let stamp = d.getTime();
    stamp = stamp < 0 ? NaN : stamp;
    return stamp;
  },
  // Input is a unix timestamp return by the parse function
  format: (value: number, options: any) => {
    const date = new Date(value);
    const dateStr = `${date.getFullYear()}-${pad2D(date.getMonth() + 1)}-${pad2D(date.getDate())}`;
    return options.dateOnly
      ? dateStr
      : dateStr + ' ' + `${pad2D(date.getHours())}:${pad2D(date.getMinutes())}:${pad2D(date.getSeconds())}`;
  },
});

// ===========
