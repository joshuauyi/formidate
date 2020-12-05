import Formidate from '..';
import FormGroup from '../FormGroup';

const FD = Formidate;

// tslint:disable: no-string-literal
const validator: FormGroup = FD.group({
  username: FD.control(FD.rules().required(), 'john'),
  password: FD.control(
    FD.rules()
      .required()
      .minLength(6),
    'password',
  ),
});

const initFalseValidator = FD.group({
  username: FD.control(FD.rules().required(), 'john'),
  password: FD.control(
    FD.rules()
      .required()
      .minLength(6),
  ),
});

describe('Formidate', () => {
  describe('instance', () => {
    it('should be an instance of FD', () => {
      expect(validator).toBeInstanceOf(FormGroup);
    });

    it('should validate successfully', done => {
      validator.render(isValid => {
        expect(isValid).toBeTruthy();
        done();
      });
      validator.validate({ target: { name: 'username', value: 'Jane' } });
    });

    it('should add defined input objects', () => {
      expect(validator.get('username')).toBeDefined();
      expect(validator.get('gender')).toBeNull();
    });

    it('should validate immediate validator is instantiated', () => {
      const vt = FD.group({
        name: FD.control(FD.rules().required(), 'james'),
        gender: FD.control(FD.rules().required(), 'Male'),
      });
      const vf = FD.group({
        name: FD.control(FD.rules().required()),
        gender: FD.control(FD.rules().required()),
      });
      expect(vt.valid()).toBeTruthy();
      expect(vf.valid()).toBeFalsy();
    });

    it('should be false when empty values are validated', done => {
      validator.render(isValid => {
        expect(isValid).toBeFalsy();
        done();
      });

      validator.validate({ target: { name: 'username', value: '  ' } });
    });
  });

  describe('addControl', () => {
    it('should add a control to FD instance', () => {
      const v3 = FD.group({
        name: FD.control(FD.rules().required()),
      });

      v3.addControls({ gemn: FD.control(FD.rules().required()) });

      expect(v3.controls.gemn).toBeDefined();
      expect(Object.keys(v3.controls).length).toBe(2);
      expect(Object.keys(v3['rules']).length).toBe(2);
      expect(v3['considered'].length).toBe(2);
    });
  });

  describe('removeControl', () => {
    it('should remove specified control', () => {
      const v4 = FD.group({
        username: FD.control(FD.rules().required()),
        email: FD.control(FD.rules().required()),
      });

      const removedField = 'username';
      v4.removeControls(removedField);

      expect(Object.keys(v4.controls).length).toBe(1);
      expect(v4.controls.username).toBeUndefined();

      expect(Object.keys(v4['rules']).length).toBe(1);
      expect(v4['rules'][removedField]).toBeUndefined();

      expect(Object.keys(v4.values()).length).toBe(1);
      expect(v4.values()[removedField]).toBeUndefined();

      expect(v4['considered'].length).toBe(1);
      expect(v4['considered'].indexOf(removedField)).toBeLessThan(0);
    });
  });

  describe('updateValues', () => {
    it('should update control values', () => {
      const v4 = FD.group({
        username: FD.control(FD.rules().required()),
        email: FD.control(FD.rules().required()),
      });

      v4.updateValues({ username: 'John' });

      expect(v4.controls.username.getValue()).toBe('John');
    });
  });

  describe('touchAll', () => {
    it('should update control values', () => {
      const v4 = FD.group({
        username: FD.control(FD.rules().required()),
        email: FD.control(FD.rules().required()),
      });

      v4.touchAll();

      expect(v4.controls.username.touched).toBe(true);
      expect(v4.controls.email.touched).toBe(true);
    });
  });

  describe('unTouchAll', () => {
    it('should call _toggleControlsTouched', () => {
      const v4 = FD.group({
        username: FD.control(FD.rules().required()),
        email: FD.control(FD.rules().required()),
      });

      v4['_toggleControlsTouched'] = jest.fn();
      v4.unTouchAll();

      expect(v4['_toggleControlsTouched']).toHaveBeenCalledWith(false);
    });
  });

  describe('control with data-formidate-control attribute', () => {
    it('should use custom name passed in formidate-control attribute as control name', done => {
      const v5 = FD.group({
        customControl: FD.control(FD.rules().required()),
        email: FD.control(FD.rules().required()),
      });

      v5.render((isValid, controls) => {
        expect(controls.customControl.errors.length).toBe(0);
        done();
      });

      expect(v5.controls.customControl.errors.length).toBeGreaterThan(0);
      v5.validate({ target: { name: 'username', value: 'john', 'data-formidate-control': 'customControl' } });
    });
  });

  describe('presence constraint', () => {
    it('should convert truthy presence constraint to object', () => {
      const validator6 = FD.group({
        username: FD.control(FD.rules().required()),
        gender: FD.control(FD.rules().required(null, false)),
        age: FD.control(FD.rules().required(null, true)),
      });
      const val6Rules = validator6['rules'];

      expect(typeof val6Rules.username.presence).toBe('object');
      expect(val6Rules.username.presence?.allowEmpty).toBeFalsy();

      expect(typeof val6Rules.gender.presence).toBe('object');
      expect(val6Rules.gender.presence?.allowEmpty).toBeFalsy();

      expect(typeof val6Rules.age.presence).toBe('object');
      expect(val6Rules.age.presence?.allowEmpty).toBeTruthy();
    });
  });

  describe('getGroupedErrors', () => {
    it('should return grouped errors', () => {
      const grp = FD.group({
        name: FD.control(FD.rules().required()),
      });
      const result = grp['getGroupedErrors']({
        name: { exclusion: 'Is already present', presence: 'Is required' },
      });
      expect(result).toEqual({ name: ['Is already present', 'Is required'] });
    });
  });

  describe('bind', () => {
    it('should add event listeners', () => {
      const vald = FD.group({
        username: FD.control(FD.rules().required()),
      });
      const form = document.createElement('form');
      form.addEventListener = jest.fn();
      vald.bind(form);
      expect(form.addEventListener).toHaveBeenCalledWith('input', expect.anything(), true);
    });

    it('should add event listener for each passed event once', () => {
      const vald = FD.group({
        username: FD.control(FD.rules().required()),
      });
      const form = document.createElement('form');
      form.addEventListener = jest.fn();
      vald.bind(form, ['input', 'focus']);
      expect(form.addEventListener).toHaveBeenCalledTimes(2);
    });

    it('should remove event listeners from previous form if new form is bound', () => {
      const vald = FD.group({
        username: FD.control(FD.rules().required()),
      });
      const form = document.createElement('form');
      form.removeEventListener = jest.fn();
      vald.bind(form);
      vald.bind(document.createElement('form'));
      expect(form.removeEventListener).toHaveBeenCalled();
    });
  });
});
