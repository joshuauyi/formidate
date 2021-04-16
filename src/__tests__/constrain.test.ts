import Constrain from '../Constrain';
import {
  IExclusionGroupRule,
  IFormatMainRule,
  IInclusionGroupRule,
  IMainEmailRule,
  IMainEqualityRule,
  ITypeMainRule,
  IURLMainRule,
} from '../models/control-rules';

const createConstrain = (defaultValue?: string | null) => new Constrain(defaultValue);

describe('Control Rules', () => {
  describe('date', () => {
    it('should create an abject rule', () => {
      const rules = createConstrain().date().serialize();
      expect(rules.datetime).toBeDefined();
      expect(typeof rules.datetime).toBe('object');
    });

    it('should set dateonly to true', () => {
      const rules = createConstrain().date(true).serialize();
      expect(rules.datetime?.dateOnly).toBe(true);
    });

    it('should set dateonly to false', () => {
      const rules = createConstrain().date(false).serialize();
      expect(rules.datetime?.dateOnly).toBe(false);
    });

    it('should set notValid and override message', () => {
      const rules = createConstrain().date(false, 'not a valid date', 'should be a date').serialize();
      expect(rules.datetime?.notValid).toBe('not a valid date');
      expect(rules.datetime?.message).toBe('should be a date');
    });
  });

  describe('beforeDate', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().beforeDate('10/10/2020', 'must be before').serialize();
      expect(rules.datetime?.latest).toBe('10/10/2020');
      expect(rules.datetime?.tooLate).toBe('must be before');
    });
  });

  describe('afterDate', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().afterDate('10/10/2020', 'must be after').serialize();
      expect(rules.datetime?.earliet).toBe('10/10/2020');
      expect(rules.datetime?.tooEarly).toBe('must be after');
    });
  });

  describe('email', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().email('must be after').serialize();
      rules.email = rules.email as IMainEmailRule;
      expect(rules.email?.message).toBe('must be after');
    });

    it('should be true if no message is passed', () => {
      const rules = createConstrain().email().serialize();
      expect(rules.email).toBeDefined();
      expect(rules.email).toBe(true);
    });
  });

  describe('sameAs', () => {
    it('should set passed properties', () => {
      const comparator = (a: string, b: string) => a === b;
      const rules = createConstrain().sameAs('pass', 'should be same as', comparator).serialize();
      rules.equality = rules.equality as IMainEqualityRule;
      expect(rules.equality?.attribute).toBe('pass');
      expect(rules.equality?.message).toBe('should be same as');
      expect(rules.equality?.comparator).toBe(comparator);
    });
  });

  describe('excludes', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().excludes(['pass'], 'should not contain').serialize();
      rules.exclusion = rules.exclusion as IExclusionGroupRule;
      expect(rules.exclusion).toBeDefined();
      expect(rules.exclusion?.within).toEqual(['pass']);
      expect(rules.exclusion?.message).toBe('should not contain');
    });
  });

  describe('includes', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().includes(['pass'], 'should contain').serialize();
      rules.inclusion = rules.inclusion as IInclusionGroupRule;
      expect(rules.inclusion).toBeDefined();
      expect(rules.inclusion?.within).toEqual(['pass']);
      expect(rules.inclusion?.message).toBe('should contain');
    });
  });

  describe('matches', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().matches('d+', 'g', 'should match').serialize();

      rules.format = rules.format as IFormatMainRule;

      expect(rules.format).toBeDefined();
      expect(rules.format.pattern).toBe('d+');
      expect(rules.format?.flags).toBe('g');
      expect(rules.format?.message).toBe('should match');
    });
  });

  describe('lengthConfig', () => {
    it('should set passed properties', () => {
      const tok = (v: string) => v.split(' ');
      const rules = createConstrain().lengthConfig(tok, 'not valid', 'default error msg').serialize();

      expect(rules.length).toBeDefined();
      expect(rules.length?.tokenizer).toEqual(tok);
      expect(rules.length?.notValid).toBe('not valid');
      expect(rules.length?.message).toBe('default error msg');
    });
  });

  describe('length', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().length(5, 'wrong').serialize();

      expect(rules.length).toBeDefined();
      expect(rules.length?.is).toBe(5);
      expect(rules.length?.wrongLength).toBe('wrong');
    });
  });

  describe('minLength', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().minLength(5, 'wrong').serialize();

      expect(rules.length).toBeDefined();
      expect(rules.length?.minimum).toBe(5);
      expect(rules.length?.tooShort).toBe('wrong');
    });
  });

  describe('maxLength', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().maxLength(5, 'wrong').serialize();

      expect(rules.length).toBeDefined();
      expect(rules.length?.maximum).toBe(5);
      expect(rules.length?.tooLong).toBe('wrong');
    });
  });

  describe('number', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().number('wrong', true, 'default msg').serialize();

      expect(rules.numericality?.strict).toBe(true);
      expect(rules.numericality?.notValid).toBe('wrong');
      expect(rules.numericality?.message).toBe('default msg');
    });
  });

  describe('integer', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().integer('wrong').serialize();

      expect(rules.numericality?.onlyInteger).toBe(true);
      expect(rules.numericality?.notInteger).toBe('wrong');
    });
  });

  describe('double', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().double().serialize();

      expect(rules.numericality?.onlyInteger).toBe(false);
    });
  });

  describe('greaterThan', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().greaterThan(6, 'wrong').serialize();

      expect(rules.numericality?.greaterThan).toBe(6);
      expect(rules.numericality?.notGreaterThan).toBe('wrong');
    });
  });

  describe('greaterThanOrEquals', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().greaterThanOrEquals(6, 'wrong').serialize();

      expect(rules.numericality?.greaterThanOrEqualTo).toBe(6);
      expect(rules.numericality?.notGreaterThanOrEqualTo).toBe('wrong');
    });
  });

  describe('equals', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().equals(6, 'wrong').serialize();

      expect(rules.numericality?.equalTo).toBe(6);
      expect(rules.numericality?.notEqualTo).toBe('wrong');
    });
  });

  describe('lessThanOrEquals', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().lessThanOrEquals(6, 'wrong').serialize();

      expect(rules.numericality?.lessThanOrEqualTo).toBe(6);
      expect(rules.numericality?.notLessThanOrEqualTo).toBe('wrong');
    });
  });

  describe('lessThan', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().lessThan(6, 'wrong').serialize();

      expect(rules.numericality?.lessThan).toBe(6);
      expect(rules.numericality?.notLessThan).toBe('wrong');
    });
  });

  describe('divisibleBy', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().divisibleBy(6, 'wrong').serialize();

      expect(rules.numericality?.divisibleBy).toBe(6);
      expect(rules.numericality?.notDivisibleBy).toBe('wrong');
    });
  });

  describe('odd', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().odd('wrong').serialize();

      expect(rules.numericality?.odd).toBe(true);
      expect(rules.numericality?.notOdd).toBe('wrong');
    });
  });

  describe('even', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().even('wrong').serialize();

      expect(rules.numericality?.even).toBe(true);
      expect(rules.numericality?.notEven).toBe('wrong');
    });
  });

  describe('required', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().required('wrong', true).serialize();

      expect(rules.presence?.allowEmpty).toBe(true);
      expect(rules.presence?.message).toBe('wrong');
    });

    it('should set allowEmpty to false by default', () => {
      const rules = createConstrain().required().serialize();

      expect(rules.presence?.allowEmpty).toBe(false);
    });
  });

  describe('isType', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().isType('string', 'wrong').serialize();
      rules.type = rules.type as ITypeMainRule;
      expect(rules.type?.type).toBe('string');
      expect(rules.type?.message).toBe('wrong');
    });
  });

  describe('url', () => {
    it('should set passed properties', () => {
      const rules = createConstrain().url('wrong', [], false, true).serialize();
      rules.url = rules.url as IURLMainRule;
      expect(rules.url?.message).toBe('wrong');
      expect(rules.url?.schemes).toEqual([]);
      expect(rules.url?.allowLocal).toBe(false);
      expect(rules.url?.allowDataUrl).toBe(true);
    });
  });

  describe('custom', () => {
    it('should set passed properties', () => {
      const rules = createConstrain()
        .custom(() => null)
        .serialize();
      expect(rules.custom).toBeDefined();
      expect(typeof rules.custom).toBe('function');
    });
  });

  describe('customAsync', () => {
    it('should set passed properties', () => {
      const rules = createConstrain()
        .customAsync(() => (res) => res())
        .serialize();
      expect(rules.customAsync).toBeDefined();
      expect(typeof rules.customAsync).toBe('function');
    });
  });

  describe('rawRules', () => {
    it('should set passed properties', () => {
      const rules = createConstrain()
        .rawRules({
          email: true,
          length: { minimum: 8 },
        })
        .serialize();
      expect(rules.email).toBe(true);
      expect(rules.length?.minimum).toBe(8);
    });
  });
});
