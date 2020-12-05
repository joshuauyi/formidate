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
  IMappedErrors,
  IValidationCallback,
} from './models/models';

class FormGroup {
  private static instanceCount = 0;

  public controls: IFormControlsMap = {};
  private options: IFormidateOptions = {};
  private considered: string[] = [];
  private rules: IFormRules = {};
  private customAsyncRuleKeys: string[] = [];
  private _values: IFormValuesMap = {};
  private _valid = true;
  private lastBoundForm?: HTMLFormElement;
  private mappedErrors: IMappedErrors = {};
  private validationCount = 0;
  private _renderCallback: IValidationCallback = null;

  constructor(controls: IFormControlsMap, fullMessages: boolean) {
    this.options = { fullMessages, instanceCount: ++FormGroup.instanceCount, format: 'mapped' };
    this._addMultipleControls(controls);
  }

  public addControls(controls: IFormControlsMap) {
    this._addMultipleControls(controls);
  }

  public removeControls(...controlNames: string[]) {
    for (const controlName of controlNames) {
      if (this.considered.indexOf(controlName) === -1) {
        continue;
      }

      delete this.rules[controlName];
      delete this.controls[controlName];
      delete this._values[controlName];
      this.considered = this.considered.filter(item => item !== controlName);
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

  public touch(controlName: string) {
    this.controls[controlName].setTouched(true);
    this.callRender();
  }

  public unTouch(controlName: string) {
    this.controls[controlName].setTouched(false);
    this.callRender();
  }

  public touchAll() {
    this._toggleControlsTouched(true);
  }

  public unTouchAll() {
    this._toggleControlsTouched(false);
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
    this.revalidate();
  }

  public bind(form: HTMLFormElement, events?: AllowedEvents) {
    events = events || ['input'];
    const allowedEvents = ['input', 'focus', 'blur'];

    if (this.lastBoundForm && this.lastBoundForm !== form) {
      const { lastBoundForm } = this;
      allowedEvents.forEach(eventName => lastBoundForm.removeEventListener(eventName, this.formListener, true));
    }

    this.lastBoundForm = form;

    events.forEach(eventName => {
      if (allowedEvents.indexOf(eventName) > -1) {
        form.addEventListener(eventName, this.formListener, true);
      }
    });
  }

  private formListener = (event: any) => this.validate(event);

  private validate(nativeEvent: { [key: string]: any }) {
    setTimeout(() => {
      this.incrementValidationCount();
      const currentCount = this.validationCount;
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

      const toValidateRules: IFormRules = this.removeAsyncRules(name);

      // place control in error mode if it has an async validation
      if (this.rules[name].customAsync) {
        this.controls[name].setLoading(true);
        this.updateValidState();
      }

      validate
        .async(this._values, toValidateRules, this.options)
        .then(() => {
          this.mappedErrors = this.appendExistingAsyncErrors({}, name);
        })
        .catch((err: any) => {
          if (err instanceof Error) {
            throw err;
          }
          if (err === ASYNC_RESET_INDICATOR) {
            controlIsLoading = true;
            return;
          }

          const newMappedErrors: IMappedErrors = this.appendExistingAsyncErrors(err || {}, name);

          // result from async validation may come after a new validation has been triggered, in that case use only the result from the customAsync rule
          if (currentCount < this.validationCount) {
            if (newMappedErrors[name]?.customAsync) {
              this.mappedErrors[name] = this.mappedErrors[name] || {};
              this.mappedErrors[name].customAsync = newMappedErrors[name].customAsync;
            }
          } else {
            this.mappedErrors = newMappedErrors;
          }
        })
        .finally(() => {
          this.controls[name].setTouched(true); // touch currently edited control
          const foundErrors: { [key: string]: string[] } = this.getGroupedErrors(this.mappedErrors);
          this.considered.forEach(controlName => this.controls[controlName].setErrors(foundErrors[controlName] || []));
          this.controls[name].setLoading(controlIsLoading);
          this.updateValidState();
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

      if (controlRules.customAsync) {
        this.customAsyncRuleKeys.push(key);
      }

      newRules[key] = controlRules;
      updateRules[key] = controlRules;
    }
    this.rules = updateRules;

    // validate all newly added fields
    this.revalidate();
  }

  private appendExistingAsyncErrors(errors: IMappedErrors, exceptFor?: string): IMappedErrors {
    // when validating a field, async rules are not included in the validation, hence, we manually set the last know async error
    const newMappedErrors: IMappedErrors = { ...errors };

    this.customAsyncRuleKeys.forEach(asyncValidatorKey => {
      if (asyncValidatorKey === exceptFor) {
        return;
      }
      if (this.mappedErrors[asyncValidatorKey]?.customAsync && !newMappedErrors[asyncValidatorKey]?.customAsync) {
        newMappedErrors[asyncValidatorKey] = newMappedErrors[asyncValidatorKey] || {};
        newMappedErrors[asyncValidatorKey].customAsync = this.mappedErrors[asyncValidatorKey].customAsync;
      }
    });
    return newMappedErrors;
  }

  private removeAsyncRules(exceptFor?: string): IFormRules {
    // only process async validator of field passed as exceptFor,remove the customAsync rule for other controls
    const toValidateRules = { ...this.rules };
    this.customAsyncRuleKeys.forEach(asyncValidatorKey => {
      if (asyncValidatorKey === exceptFor) {
        return;
      }

      const { customAsync, ...restControlValidateRules } = toValidateRules[asyncValidatorKey];
      toValidateRules[asyncValidatorKey] = restControlValidateRules;
    });
    return toValidateRules;
  }

  private revalidate() {
    this.incrementValidationCount();
    const toValidateRules: IFormRules = this.removeAsyncRules();
    validate
      .async(this._values, toValidateRules, this.options)
      .then(() => {
        this.mappedErrors = this.appendExistingAsyncErrors({});
      })
      .catch(err => {
        if (err instanceof Error) {
          throw err;
        }

        const newMappedErrors: IMappedErrors = this.appendExistingAsyncErrors(err || {}, name);
        this.mappedErrors = newMappedErrors;
      })
      .finally(() => {
        const validationErrors = this.getGroupedErrors(this.mappedErrors);
        this.considered.map(controlKey => this.controls[controlKey].setErrors(validationErrors[controlKey] || []));
        this.updateValidState();
      });
  }

  private _toggleControlsTouched(touchedState: boolean) {
    for (const controlKey of this.considered) {
      this.controls[controlKey].setTouched(touchedState);
    }
    this.callRender();
  }

  private updateControlValue(name: string, value: string | null) {
    this._values = { ...this._values, [name]: value };
    this.controls[name].setValue(value);
  }

  private getGroupedErrors(mappedErrors: IMappedErrors) {
    const grouped: { [key: string]: string[] } = {};
    const controlNames = Object.keys(mappedErrors);
    for (const name of controlNames) {
      grouped[name] = [];
      const errors: { [key: string]: string } = mappedErrors[name];
      const validatorKeys = Object.keys(errors);
      for (const key of validatorKeys) {
        const error: string = errors[key];
        grouped[name].push(error);
      }
    }
    return grouped;
  }

  private incrementValidationCount() {
    this.validationCount += 0.1;
  }
}

export default FormGroup;
