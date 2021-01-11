import Formidate from '..';
import FormGroup from '../FormGroup';

const FD = Formidate;

// tslint:disable: no-string-literal
const validator: FormGroup = FD.group({
  username: FD.control(FD.rules().required(), 'john'),
  password: FD.control(FD.rules().required().minLength(6), 'password'),
});

describe('FormControl', () => {
  describe('instance', () => {
    it('should be an instance of FD', () => {
      expect(validator).toBeInstanceOf(FormGroup);
    });

    it('should validate successfully', (done) => {
      validator.render((isValid) => {
        expect(isValid).toBeTruthy();
        done();
      });
      validator['validate']({ target: { name: 'username', value: 'Jane' } });
    });

    it('should add defined input objects', () => {
      expect(validator.get('username')).toBeDefined();
      expect(validator.get('gender')).toBeNull();
    });

    it('should validate filled controls to true immediate validator is instantiated', (done) => {
      const vt = FD.group({
        name: FD.control(FD.rules().required(), 'james'),
        gender: FD.control(FD.rules().required(), 'Male'),
      });
      vt.render((isValid) => {
        expect(isValid).toBe(true);
        done();
      });
    });

    it('should validate with async rules', (done) => {
      const vt = FD.group({
        name: FD.constrain('james')
          .required()
          .customAsync(() => (resolve) => resolve('James is not good')),
        gender: FD.constrain('Male').required(),
      });
      let refresher: any;
      vt.render((isValid) => {
        // keep clearing timout so the last render call is used
        if (refresher) {
          clearTimeout(refresher);
        }
        refresher = setTimeout(() => {
          expect(isValid).toBe(false);
          done();
        }, 300);
      });
    });

    it('should validate empty controls to false immediate validator is instantiated', (done) => {
      const vf = FD.group({
        name: FD.control(FD.rules().required()),
        gender: FD.control(FD.rules().required()),
      });
      vf.render((isValid) => {
        expect(isValid).toBe(false);
        done();
      });
    });

    it('should be false when empty values are validated', (done) => {
      validator.render((isValid) => {
        expect(isValid).toBeFalsy();
        done();
      });

      validator['validate']({ target: { name: 'username', value: '  ' } });
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

      expect(Object.keys(v4.values).length).toBe(1);
      expect(v4.values[removedField]).toBeUndefined();

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

  describe('getControls', () => {
    it('should return store controls', () => {
      const v4 = FD.group({ username: FD.constrain().required() });

      const c = v4.getControls();
      expect(typeof c).toBe('object');
      expect(c).toHaveProperty('username');
    });
  });

  describe('reset', () => {
    it('should reset controls and controls state', () => {
      const v4 = FD.group({ username: FD.constrain('John').required().minLength(10) });

      v4.reset();

      expect(v4.controls.username.errors.length).toBe(0);
      expect(v4.controls.username.valid).toBe(false);
      expect(v4.invalid).toBe(true);
      expect(v4.controls.username.value).toBe('John');
      expect(v4['mappedErrors'].username).toEqual({});
    });
  });

  describe('touch', () => {
    it('should touch specified control', () => {
      const v4 = FD.group({ username: FD.control(FD.rules().required()) });
      v4.touch('username');

      expect(v4.controls.username.touched).toBe(true);
    });
  });

  describe('unTouch', () => {
    it('should untouch specified control', () => {
      const v4 = FD.group({ username: FD.control(FD.rules().required()) });
      v4['_toggleControlsTouched'] = jest.fn();
      v4.unTouch('username');

      expect(v4.controls.username.touched).toBe(false);
    });
  });

  describe('touchAll', () => {
    it('should touch all controls', () => {
      const v4 = FD.group({
        username: FD.control(FD.rules().required()),
        email: FD.control(FD.rules().required()),
      });

      const toggleControlsTouchedSpy = jest.spyOn(v4 as any, '_toggleControlsTouched');
      v4.touchAll();

      expect(toggleControlsTouchedSpy).toHaveBeenCalledWith(true);
      expect(v4.controls.username.touched).toBe(true);
      expect(v4.controls.email.touched).toBe(true);
    });
  });

  describe('unTouchAll', () => {
    it('should untouch all controls', () => {
      const v4 = FD.group({
        username: FD.control(FD.rules().required()),
        email: FD.control(FD.rules().required()),
      });

      const toggleControlsTouchedSpy = jest.spyOn(v4 as any, '_toggleControlsTouched');
      v4.unTouchAll();

      expect(toggleControlsTouchedSpy).toHaveBeenCalledWith(false);
      expect(v4.controls.username.touched).toBe(false);
      expect(v4.controls.email.touched).toBe(false);
    });
  });

  describe('control with data-formidate-control attribute', () => {
    it('should use custom name passed in formidate-control attribute as control name', (done) => {
      const v5 = FD.group({
        customControl: FD.control(FD.rules().required()),
        email: FD.control(FD.rules().required()),
      });

      v5.render((isValid, controls) => {
        expect(controls.customControl).toBeDefined();
        expect(controls.customControl.errors).toBeInstanceOf(Array);
        done();
      });

      v5['validate']({ target: { name: 'username', value: 'john', 'data-formidate-control': 'customControl' } });
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

    it('should trigger runAndMergeAsyncValidators', (done) => {
      const grp = FD.group({ username: FD.constrain().required() });
      const form = document.createElement('form');
      const runAndMergeAsyncValidatorsSpy = jest.spyOn(grp as any, 'runAndMergeAsyncValidators');
      grp.bind(form);
      setTimeout(() => {
        expect(runAndMergeAsyncValidatorsSpy).toHaveBeenCalled();
        done();
      }, 500);
    });

    it('should trigger validation with the form input values', (done) => {
      const vald = FD.group({ username: FD.constrain('sdsdf').required() });
      const form = document.createElement('form');
      const input = document.createElement('input');
      input.name = 'username';
      input.value = 'Joshua';
      form.appendChild(input);
      vald.bind(form);
      setTimeout(() => {
        expect(vald.valid).toBe(true);
        done();
      }, 200);
    });

    it('should throw when not boudnt to an HTML Form', () => {
      const grp = FD.group({ username: FD.constrain().required() });

      expect(() => grp.bind('ta-da' as any)).toThrow('Only HTML Forms can be bound to validator');
    });
  });

  describe('validate', () => {
    it('should be triggered by form input change', (done) => {
      const vt = FD.group({
        name: FD.constrain()
          .required()
          .customAsync(() => (resolve) => setTimeout(() => resolve(), 20)),
      });

      let refresher: any;
      vt.render((isValid) => {
        // keep clearing timout so the last render call is used
        if (refresher) {
          clearTimeout(refresher);
        }
        refresher = setTimeout(() => {
          expect(isValid).toBe(true);
          done();
        }, 50);
      });

      const form = document.createElement('form');
      const input = document.createElement('input');
      input.name = 'name';
      form.appendChild(input);
      vt.bind(form);

      input.value = 'John';
      input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

      input.value = 'Joshua';
      input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    });
  });
});
