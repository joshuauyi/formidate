import { ASYNC_RESET_INDICATOR, validate } from './constants';
import Constrain from './Constrain';
import FormControl from './FormControl';
import { IFormRuleItem } from './models/control-rules';
import {
  AllowedEvents,
  IConstrainsMap,
  IFormControlsMap,
  IFormidateOptions,
  IFormRules,
  IFormValuesMap,
  IMappedErrors,
  IValidationCallback,
} from './models/models';

class FormGroup {
  private static instanceCount = 0;

  private _controls: IFormControlsMap = {};
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
  private lastAsyncVal: { [key: string]: string | null } = {};

  constructor(constrains: IConstrainsMap, fullMessages: boolean) {
    this.options = { fullMessages, instanceCount: ++FormGroup.instanceCount, format: 'mapped' };
    this._addMultipleControls(constrains);
  }

  public addControls(constrains: IConstrainsMap) {
    this._addMultipleControls(constrains);
  }

  public removeControls(...controlNames: string[]) {
    for (const controlName of controlNames) {
      if (this.considered.indexOf(controlName) === -1) {
        continue;
      }

      this.clearControl(controlName);
      this.considered = this.considered.filter((item) => item !== controlName);
      this.updateValidState();
    }
  }

  public get(controlName: string) {
    return this.controls[controlName] || null;
  }

  public get controls(): IFormControlsMap {
    return this._controls;
  }

  /** @deprecated */
  public getControls() {
    return this.controls;
  }

  public get values(): IFormValuesMap {
    return this._values;
  }

  public get valid() {
    return this._valid;
  }

  public get invalid() {
    return !this.valid;
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
      this.controls[controlName].reset();
      this.mappedErrors[controlName] = {};
    }
    this.forceValidState(false);
  }

  public updateValues(values: IFormValuesMap) {
    for (const key of this.considered) {
      if (values[key] !== undefined) {
        this.updateControlValue(key, values[key]);
      }
    }
    this.runSyncValidators().then(() => this.runAndMergeAsyncValidators(Object.keys(values)));
  }

  public bind(form: HTMLFormElement, events?: AllowedEvents) {
    if (!(form instanceof HTMLFormElement)) {
      throw new Error('Only HTML Forms can be bound to validator');
    }

    events = events || ['input'];
    const allowedEvents = ['input', 'focus', 'blur'];

    if (this.lastBoundForm && this.lastBoundForm !== form) {
      const { lastBoundForm } = this;
      allowedEvents.forEach((eventName) => lastBoundForm.removeEventListener(eventName, this.formListener, true));
    }

    this.lastBoundForm = form;

    events.forEach((eventName) => {
      if (allowedEvents.indexOf(eventName) > -1) {
        form.addEventListener(eventName, this.formListener, true);
      }
    });

    setTimeout(() => {
      const inputValues = validate.collectFormValues(form);
      this.considered.forEach((inputName: string) => {
        if (inputValues[inputName] !== undefined) {
          this.updateControlValue(inputName, inputValues[inputName]);
        }
      });
      this.runSyncValidators().then(() => this.runAndMergeAsyncValidators());
    }, 2);
  }

  private clearControl(controlName: string) {
    delete this.rules[controlName];
    delete this.controls[controlName];
    delete this.mappedErrors[controlName];
    delete this._values[controlName];
    delete this.lastAsyncVal[controlName];
    this.customAsyncRuleKeys = this.customAsyncRuleKeys.filter((item) => item !== controlName);
  }

  private formListener = (event: any) => this.validate(event);

  private validate(nativeEvent: { [key: string]: any }) {
    setTimeout(() => {
      this.incrementValidationCount();
      const currentCount = this.validationCount;
      const { target } = nativeEvent;
      const input = target || {};
      const { type } = input;
      let { name, value } = input;
      let formControlAttrName;

      if (input.getAttribute) {
        formControlAttrName = input.getAttribute('data-formidate-control') || input.getAttribute('formidate-control');
      } else {
        const { 'formidate-control': formControl, 'data-formidate-control': dataFormControl } = input;
        formControlAttrName = dataFormControl || formControl;
      }

      name = formControlAttrName || name;
      if (!this.controls[name]) {
        return;
      }

      let controlIsLoading = false;

      if (type === 'checkbox' && !input.checked) {
        value = null;
      }

      this.updateControlValue(name, value);

      const toValidateRules: IFormRules = this.removeAsyncRules(name);
      const controlHasAsyncRules = !!this.rules[name].customAsync;
      const targetControlUsedValue = this.controls[name].value;

      // place control in error mode if it has an async validation
      if (controlHasAsyncRules) {
        this.controls[name].setLoading(true);
        this.forceValidState(false);
        this.lastAsyncVal[name] = this.controls[name].value;
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

          // result from async validation for one control may come after a new validation for another controlhas been triggered,
          // in that case use only the result from the customAsync rule
          // also check that the current control value is same as the last know value used in an async validation for the control
          if (
            controlHasAsyncRules &&
            currentCount < this.validationCount &&
            this.lastAsyncVal[name] === targetControlUsedValue
          ) {
            this.mappedErrors[name] = this.mappedErrors[name] || {};
            const newAsyncError = newMappedErrors[name]?.customAsync;
            if (newAsyncError) {
              this.mappedErrors[name].customAsync = newAsyncError;
            } else {
              delete this.mappedErrors[name].customAsync;
            }
          } else {
            this.mappedErrors = newMappedErrors;
          }
        })
        .finally(() => {
          this.controls[name].setTouched(true); // touch currently edited control
          const foundErrors: { [key: string]: string[] } = this.getGroupedErrors(this.mappedErrors);
          this.considered.forEach((controlName) =>
            this.controls[controlName].setErrors(foundErrors[controlName] || []),
          );
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
      if (this.controls[key].hasError() || this.controls[key].loading) {
        this.forceValidState(false);
        return;
      }
    }
    this.forceValidState(true);
  }

  private forceValidState(validState: boolean) {
    this._valid = validState;
    this.callRender();
  }

  private _addMultipleControls(constrains: IConstrainsMap) {
    const controlNames = Object.keys(constrains);

    this.considered = [...this.considered, ...controlNames];

    const updateRules: IFormRules = { ...this.rules };

    for (const key of controlNames) {
      if (this.controls[key]) {
        this.clearControl(key);
      }
      const constrain: Constrain = constrains[key];
      const control = new FormControl(key, constrain);
      this.controls[key] = control;
      this._values[key] = control.value;

      const controlRules: IFormRuleItem = control.getRules();

      if (controlRules.customAsync) {
        this.customAsyncRuleKeys.push(key);
      }

      updateRules[key] = controlRules;
    }
    this.rules = updateRules;

    this.runSyncValidators().then(() => this.runAndMergeAsyncValidators(Object.keys(constrains)));
  }

  private appendExistingAsyncErrors(errors: IMappedErrors, exceptFor?: string): IMappedErrors {
    // when validating, async rules are not included in the validation, and thus no erros are generated for them
    // thus we manually set the last known async error, except for the field currently edited (if specified in exceptFor)

    const newMappedErrors: IMappedErrors = { ...errors };

    this.customAsyncRuleKeys.forEach((asyncValidatorKey) => {
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
    this.customAsyncRuleKeys.forEach((asyncValidatorKey) => {
      if (asyncValidatorKey === exceptFor) {
        return;
      }

      const { customAsync, ...restControlValidateRules } = toValidateRules[asyncValidatorKey];
      toValidateRules[asyncValidatorKey] = restControlValidateRules;
    });
    return toValidateRules;
  }

  private runSyncValidators() {
    this.incrementValidationCount();
    const toValidateRules: IFormRules = this.removeAsyncRules();

    return validate
      .async(this._values, toValidateRules, this.options)
      .then(() => {
        this.mappedErrors = this.appendExistingAsyncErrors({});
      })
      .catch((err) => {
        if (err instanceof Error) {
          throw err;
        }

        const newMappedErrors: IMappedErrors = this.appendExistingAsyncErrors(err || {});
        this.mappedErrors = newMappedErrors;
      })
      .finally(() => {
        const validationErrors = this.getGroupedErrors(this.mappedErrors);
        this.considered.forEach((controlKey) => {
          this.controls[controlKey].setErrors(validationErrors[controlKey] || []);
        });
        this.updateValidState();
      });
  }

  private runAndMergeAsyncValidators(onlyFor?: string[]) {
    const arrayIntersect = (arr1: any[], arr2: any[]) => arr1.filter((n) => arr2.indexOf(n) !== -1);
    const asyncControlNames = onlyFor ? arrayIntersect(onlyFor, this.customAsyncRuleKeys) : this.customAsyncRuleKeys;
    // stub all contrul rules with any empty object
    const stubRules = this.considered.reduce((acc: any, ctrKey) => {
      acc[ctrKey] = {};
      return acc;
    }, {});
    asyncControlNames.forEach((controlName) => {
      const { customAsync } = this.rules[controlName];
      // if the control does not have an async rule or the control current value is same as the last value that was validated, then there is no need to validate the control
      if (!customAsync || this.lastAsyncVal[controlName] === this.controls[controlName].value) {
        return;
      }
      // assign only customAsync validator to the current control, and a stub (empty object) to the others,
      // so their values are included in the validation but are not validated
      const toValidateRules = { ...stubRules, [controlName]: { customAsync } };
      this.controls[controlName].setLoading(true);
      this.lastAsyncVal[controlName] = this.controls[controlName].value;
      this.forceValidState(false);
      const usedValue = this.controls[controlName].value;

      validate
        .async(this._values, toValidateRules, this.options)
        .catch((err) => {
          if (err instanceof Error) {
            throw err;
          }

          const valErrors = err || {};

          // only assign validation error for the control, if the control has errors and the last asyncVal for the control
          // is same as the last value validated against the control, this ensures the latest error is not overriden.
          if (valErrors[controlName] && this.lastAsyncVal[controlName] === usedValue) {
            this.mappedErrors[controlName] = this.mappedErrors[controlName] || {};
            this.mappedErrors[controlName].customAsync = valErrors[controlName].customAsync;
          }
        })
        .finally(() => {
          const validationErrors = this.getGroupedErrors(this.mappedErrors);
          if (this.lastAsyncVal[controlName] === usedValue) {
            this.controls[controlName].setErrors(validationErrors[controlName] || []).setLoading(false);
          }
          this.updateValidState();
        });
    });
  }

  private _toggleControlsTouched(touchedState: boolean) {
    for (const controlKey of this.considered) {
      this.controls[controlKey].setTouched(touchedState);
    }
    this.callRender();
  }

  private updateControlValue(name: string, value: string | null) {
    const { [name]: control } = this.controls;
    control.value = value;
    this._values[name] = control.value;
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
    this.validationCount += 1;
  }
}

export default FormGroup;
