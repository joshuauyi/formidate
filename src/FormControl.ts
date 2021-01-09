import Constrain from './Constrain';
import { IFormRuleItem } from './models/control-rules';

class FormControl {
  public name: string = '';
  public touched = false;
  public errors: string[] = [];
  public loading = false;
  private _value: string | null = null;
  private constrain: Constrain;
  private _valid: boolean = false;

  constructor(name: string, constrain: Constrain, value: string | null) {
    this.name = name;
    this.constrain = constrain;
    this._value = value;
  }

  public setName(name: string) {
    this.name = name;
    return this;
  }

  public setTouched(touched: boolean) {
    this.touched = touched;
    return this;
  }

  public setErrors(errors: string[]) {
    this.errors = errors;
    this._valid = this.errors.length === 0;
    return this;
  }

  public setLoading(loading: boolean) {
    this.loading = loading;
    return this;
  }

  public hasError(): boolean {
    return this.errors.length > 0;
  }

  /** @deprecated */
  public isLoading(): boolean {
    return this.loading;
  }

  /** @deprecated */
  public touchedAndHasError() {
    return this.touched && this.hasError();
  }

  /** @deprecated */
  public untouchedAndHasError() {
    return !this.touched && this.hasError();
  }

  /** @deprecated */
  public touchedAndNoError() {
    return this.touched && !this.hasError();
  }

  /** @deprecated */
  public untouchedAndNoError() {
    return !this.touched && !this.hasError();
  }

  public get value(): string | null {
    return this._value;
  }

  public set value(value: string | null) {
    this._value = value && value.trim() ? value : null;
  }

  /** @deprecated */
  public setValue(value: string | null) {
    this.value = value;
    return this;
  }

  /** @deprecated */
  public getValue() {
    return this.value;
  }

  public getRules(): IFormRuleItem {
    return this.constrain.serialize();
  }

  public get untouched(): boolean {
    return !this.touched;
  }

  public get valid(): boolean {
    return this._valid;
  }

  // public set valid(valid: boolean) {
  //   this._valid = valid;
  // }

  public get invalid(): boolean {
    return !this.valid;
  }

  public reset() {
    this.setErrors([])
      .setLoading(false)
      .setTouched(false);
  }
}

export default FormControl;
