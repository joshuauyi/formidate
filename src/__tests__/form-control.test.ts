import Constrain from '../Constrain';
import FormControl from '../FormControl';

describe('FormControl', () => {
  describe('constructor', () => {
    it('should create instance with default state', () => {
      const contrain = new Constrain('paul');
      const control = new FormControl('name', contrain);

      expect(control).toBeInstanceOf(FormControl);
      expect(control.name).toEqual('name');
      expect(control.value).toEqual('paul');

      expect(control.valid).toEqual(false);
      expect(control.invalid).toEqual(true);
      expect(control.touched).toEqual(false);
      expect(control.untouched).toEqual(true);

      // deperecated methods test
      expect(control.isLoading()).toEqual(false);
      expect(control.touchedAndHasError()).toEqual(false);
      expect(control.untouchedAndHasError()).toEqual(false);
      expect(control.touchedAndNoError()).toEqual(false);
      expect(control.untouchedAndNoError()).toEqual(true);
    });
  });

  describe('reset', () => {
    it('should set control to default state', () => {
      const control = new FormControl('', new Constrain());
      control.reset();
      expect(control.errors).toEqual([]);
      expect(control.loading).toBe(false);
      expect(control.touched).toBe(false);
      expect(control.valid).toBe(false);
    });
  });

  describe('setName', () => {
    it('should set the name property', () => {
      const control = new FormControl('', new Constrain());
      control.setName('age');
      expect(control.name).toEqual('age');
    });
  });

  describe('setValue', () => {
    it('should set empty string value to null', () => {
      const control = new FormControl('name', new Constrain());
      control.setValue('');
      expect(control.value).toBe(null);
    });
  });
});
