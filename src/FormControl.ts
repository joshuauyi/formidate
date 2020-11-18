/*!
 * Formidate
 *
 * (c) 2019 Joshua Uyi
 */

import ControlRules from './ControlRules';

class FormControl {
  public touched = false;
  public errors: string[] = [];
  public loading = false;
  private value: string | null = null;
  private rules: ControlRules = new ControlRules();

  constructor(value: string | null = '', touched = false, errors = []) {
    this.value = value;
    this.touched = touched;
    this.errors = errors;
  }

  public setTouched(touched: boolean) {
    this.touched = touched;
    return this;
  }

  public setErrors(errors: string[]) {
    this.errors = errors;
    return this;
  }

  public setLoading(loading: boolean) {
    this.loading = loading;
    return this;
  }

  public hasError(): boolean {
    return this.errors.length > 0;
  }

  public isLoading(): boolean {
    return this.loading;
  }

  public touchedAndHasError() {
    return this.touched && this.hasError();
  }

  public untouchedAndHasError() {
    return !this.touched && this.hasError();
  }

  public touchedAndNoError() {
    return this.touched && !this.hasError();
  }

  public untouchedAndNoError() {
    return !this.touched && !this.hasError();
  }

  public setValue(value: string | null) {
    this.value = value;
    return this;
  }

  public getValue() {
    return this.value;
  }

  public setRules(rules: ControlRules) {
    this.rules = rules;
    return this;
  }

  public getRules() {
    return this.rules;
  }
}

export default FormControl;
