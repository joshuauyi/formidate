/*!
 * Formidate
 *
 * (c) 2019 Joshua Uyi
 */

// tslint:disable: variable-name

import validateJs from 'validate.js';
import { IFormRuleItem } from './models/control-rules';
import {
  IFormControlsMap,
  IFormidateOptions,
  IFormRules,
  IFormValuesMap,
  IValidateJS,
  IValidationCallback,
} from './models/models';

const validate: IValidateJS = validateJs;
validate.Promise = Promise;

const customAsyncTasks: any = {};
const ASYNC_RESET_INDICATOR = '___ASYNC_RESET_INDICATOR_UNIQUE_STRING___';
let instanceCount = 0;

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

class FormGroup {
  public controls: IFormControlsMap = {};
  private options: IFormidateOptions = {};
  private considered: string[] = [];
  private rules: IFormRules = {};
  private customRuleKeys: string[] = [];
  private customAsyncRuleKeys: string[] = [];
  private _values: IFormValuesMap = {};
  private _valid = true;
  private _renderCallback: IValidationCallback = null;

  constructor(controls: IFormControlsMap, options: IFormidateOptions = {}) {
    this.options = { ...options, instanceCount: ++instanceCount };

    this._addMultipleControls(controls);
    // this._addMultipleControls(Object.keys(rules), rules, { ...defaultValues });
  }

  public addControls(controls: IFormControlsMap) {
    this._addMultipleControls(controls);
  }

  public removeControls(...controlNames: string[]) {
    for (const controlName of controlNames) {
      if (!this.considered.includes(controlName)) {
        continue;
      }

      delete this.rules[controlName];
      delete this.controls[controlName];
      delete this._values[controlName];
      this.considered = this.considered.filter(item => item !== controlName);
      this.customRuleKeys = this.customRuleKeys.filter(item => item !== controlName);
      this.customAsyncRuleKeys = this.customAsyncRuleKeys.filter(item => item !== controlName);
      this.updateValidState();
    }
  }

  public get(controlName: string) {
    return this.controls[controlName] || null;
  }

  public getControls() {
    return this.controls;
  }

  public values(): IFormValuesMap {
    return this._values;
  }

  public valid() {
    return this._valid;
  }

  public invalid() {
    return !this._valid;
  }

  public touch(controlName: string, callback: (valid: boolean) => void) {
    this.controls[controlName].setTouched(true);
    this.callRender();
  }

  public touchAll() {
    this.toggleTouched(true);
  }

  public unTouchAll() {
    this.toggleTouched(false);
  }

  public render(callback: IValidationCallback = null) {
    this._renderCallback = callback;
  }

  public reset() {
    for (const controlName of this.considered) {
      this.controls[controlName]
        .setErrors([])
        .setLoading(false)
        .setTouched(false);
    }
    this._valid = false;

    this.callRender();
  }

  public updateValues(values: IFormValuesMap) {
    for (const key of this.considered) {
      if (values[key] !== undefined) {
        this.updateControlValue(key, values[key]);
      }
    }
    this._syncRevalidate(this.considered, this._values, this.rules);
  }

  public validate(nativeEvent: { [key: string]: any }) {
    setTimeout(() => {
      const { target } = nativeEvent;
      const control = target || {};
      const { type } = control;
      let { name, value } = control;
      let formControlAttrName;

      if (control.getAttribute) {
        formControlAttrName = control.getAttribute('data-validate-control') || control.getAttribute('validate-control');
      } else {
        const { 'validate-control': formControl, 'data-validate-control': dataFormControl } = control;
        formControlAttrName = dataFormControl || formControl;
      }

      name = formControlAttrName || name;
      if (this.considered.indexOf(name) < 0) {
        return;
      }

      let controlIsLoading = false;

      if (type === 'checkbox' && !control.checked) {
        value = null;
      }

      this.updateControlValue(name, value);

      const toValidateRules = { ...this.rules };

      // only process async validator of field currently edited, remove customAsync validator from other controls
      for (const asyncValidatorKey of this.customAsyncRuleKeys) {
        if (asyncValidatorKey === name) {
          continue;
        }

        const { customAsync, ...restControlValidateRules } = toValidateRules[asyncValidatorKey];
        toValidateRules[asyncValidatorKey] = restControlValidateRules;
      }

      // place control in error mode if it has an async validation
      if (this.rules[name].hasOwnProperty('customAsync')) {
        this.controls[name].setLoading(true);
        this.updateValidState();

        this.callRender();
      }

      let foundErrors: any = {};
      validate
        .async(this._values, toValidateRules, this.options)
        .then(() => {
          this.controls[name].setTouched(true).setErrors([]);
        })
        .catch((err: any) => {
          if (err instanceof Error) {
            throw err;
          }
          if (err === ASYNC_RESET_INDICATOR) {
            controlIsLoading = true;
            this.controls[name].setLoading(true);

            return;
          }
          foundErrors = err || {};

          // validate currently change field
          this.controls[name].setTouched(true).setErrors(foundErrors[name] || []);
        })
        .finally(() => {
          // update errors of all customRule fields
          for (const key of this.customRuleKeys) {
            this.controls[key].setTouched(true).setErrors(foundErrors[key] || []);
          }

          this.controls[name].setLoading(controlIsLoading);

          this.updateValidState();
          this.callRender();
        });
    }, 0);
  }

  private callRender = () => {
    if (this._renderCallback) {
      this._renderCallback(this._valid, this.controls);
    }
  };

  private updateValidState() {
    for (const key of this.considered) {
      if (this.controls[key].hasError() || this.controls[key].isLoading()) {
        this._valid = false;
        return;
      }
    }
    this._valid = true;
    this.callRender();
  }

  private _addMultipleControls(controls: IFormControlsMap) {
    const controlNames = Object.keys(controls);

    this.considered = [...this.considered, ...controlNames];

    const newControlValues: any = {};
    const newRules: IFormRules = {};
    const updateRules: IFormRules = { ...this.rules };

    for (const key of controlNames) {
      const control = controls[key];

      this.controls[key] = control;
      this._values[key] = control.getValue();

      newControlValues[key] = control.getValue();
      const controlRules: IFormRuleItem = control.getRules().serialize();

      if (controlRules.custom && Object.keys(controlRules).length === 1) {
        this.customRuleKeys.push(key);
      }

      // if (this.rules[key].presence) {
      //   if (this.rules[key].presence === true) {
      //     this.rules[key].presence = { allowEmpty: false };
      //   } else if (typeof this.rules[key].presence === 'object') {
      //     const presenseObj: any = this.rules[key].presence;
      //     this.rules[key].presence = { allowEmpty: false, ...presenseObj };
      //   }
      // }

      if (controlRules.customAsync) {
        this.customAsyncRuleKeys.push(key);
      }

      newRules[key] = controlRules;
      updateRules[key] = controlRules;
    }
    this.rules = updateRules;

    // validate all newly added fields
    this._syncRevalidate(controlNames, newControlValues, newRules);
  }

  private _syncRevalidate(controls: string[], values: IFormValuesMap, rules: IFormRules) {
    this.options.syncValidateOnly = true;
    const validationErrors = validate(values, rules, this.options) || {};
    this.options.syncValidateOnly = false;

    for (const controlKey of controls) {
      this.controls[controlKey].setErrors(validationErrors[controlKey] || []);
    }
    this.updateValidState();
  }

  private toggleTouched(touchedState: boolean) {
    for (const controlKey of this.considered) {
      this.controls[controlKey].setTouched(touchedState);
    }
    this.callRender();
  }

  private updateControlValue(name: string, value: string | null) {
    this._values = { ...this._values, [name]: value };
    this.controls[name].setValue(value);
  }
}

export default FormGroup;
