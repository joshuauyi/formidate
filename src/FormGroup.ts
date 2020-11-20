/*!
 * Formidate
 *
 * (c) 2019 Joshua Uyi
 */

// tslint:disable: variable-name

import { ASYNC_RESET_INDICATOR, validate } from './constants';
import { IFormRuleItem } from './models/control-rules';
import {
  AllowedEvents,
  IFormControlsMap,
  IFormidateOptions,
  IFormRules,
  IFormValuesMap,
  IValidationCallback,
} from './models/models';

class FormGroup {
  private static instanceCount = 0;

  public controls: IFormControlsMap = {};
  private options: IFormidateOptions = {};
  private considered: string[] = [];
  private rules: IFormRules = {};
  private customRuleKeys: string[] = [];
  private customAsyncRuleKeys: string[] = [];
  private _values: IFormValuesMap = {};
  private _valid = true;
  private _renderCallback: IValidationCallback = null;

  constructor(controls: IFormControlsMap, fullMessages: boolean) {
    this.options = { fullMessages, instanceCount: ++FormGroup.instanceCount };
    this._addMultipleControls(controls);
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
        formControlAttrName =
          control.getAttribute('data-formidate-control') || control.getAttribute('formidate-control');
      } else {
        const { 'formidate-control': formControl, 'data-formidate-control': dataFormControl } = control;
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
        });
    }, 0);
  }

  public bind(form: HTMLFormElement, events?: AllowedEvents) {
    events = events || ['input'];
    const allowedEvents = ['input', 'focus', 'blur'];

    events.forEach(eventName => {
      if (allowedEvents.indexOf(eventName) > -1) {
        form.addEventListener(eventName, event => this.validate(event), true);
      }
    });
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
        this.callRender();
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
      control.setName(key);
      this.controls[key] = control;
      this._values[key] = control.getValue();

      newControlValues[key] = control.getValue();
      const controlRules: IFormRuleItem = control.getRules().serialize();

      if (controlRules.custom && Object.keys(controlRules).length === 1) {
        this.customRuleKeys.push(key);
      }

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
