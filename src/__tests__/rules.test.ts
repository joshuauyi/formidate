import Formidate from '..';
import {
  IExclusionGroupRule,
  IFormatMainRule,
  IMainEmailRule,
  IMainEqualityRule,
  ITypeMainRule,
  IURLMainRule,
} from '../models/control-rules';

const FD = Formidate;

describe('Control Rules', () => {
  describe('date', () => {
    it('should create an abject rule', () => {
      const rules = FD.rules()
        .date()
        .serialize();
      expect(rules.datetime).toBeDefined();
      expect(typeof rules.datetime).toBe('object');
    });

    it('should set dateonly to true', () => {
      const rules = FD.rules()
        .date(true)
        .serialize();
      expect(rules.datetime?.dateOnly).toBe(true);
    });

    it('should set dateonly to true', () => {
      const rules = FD.rules()
        .date(false)
        .serialize();
      expect(rules.datetime?.dateOnly).toBe(false);
    });
  });

  describe('beforeDate', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .afterDate('10/10/2020', 'must be before')
        .serialize();
      expect(rules.datetime?.earliet).toBe('10/10/2020');
      expect(rules.datetime?.tooEarly).toBe('must be before');
    });
  });

  describe('afterDate', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .afterDate('10/10/2020', 'must be after')
        .serialize();
      expect(rules.datetime?.earliet).toBe('10/10/2020');
      expect(rules.datetime?.tooEarly).toBe('must be after');
    });
  });

  describe('email', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .email('must be after')
        .serialize();
      rules.email = rules.email as IMainEmailRule;
      expect(rules.email?.message).toBe('must be after');
    });

    it('should be true if no message is passed', () => {
      const rules = FD.rules()
        .email()
        .serialize();
      expect(rules.email).toBeDefined();
      expect(rules.email).toBe(true);
    });
  });

  describe('sameAs', () => {
    it('should set passed properties', () => {
      const comparator = (a: string, b: string) => a === b;
      const rules = FD.rules()
        .sameAs('pass', 'should be same as', comparator)
        .serialize();
      rules.equality = rules.equality as IMainEqualityRule;
      expect(rules.equality?.attribute).toBe('pass');
      expect(rules.equality?.message).toBe('should be same as');
      expect(rules.equality?.comparator).toBe(comparator);
    });
  });

  describe('excludes', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .excludes(['pass'], 'should not contain')
        .serialize();
      rules.exclusion = rules.exclusion as IExclusionGroupRule;
      expect(rules.exclusion).toBeDefined();
      expect(rules.exclusion?.within).toEqual(['pass']);
      expect(rules.exclusion?.message).toBe('should not contain');
    });
  });

  describe('matches', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .matches('d+', 'g', 'should match')
        .serialize();

      rules.format = rules.format as IFormatMainRule;

      expect(rules.format).toBeDefined();
      expect(rules.format.pattern).toBe('d+');
      expect(rules.format?.flags).toBe('g');
      expect(rules.format?.message).toBe('should match');
    });
  });

  describe('lengthConfig', () => {
    it('should set passed properties', () => {
      const tok = (v: string) => v.length;
      const rules = FD.rules()
        .lengthConfig(tok, 'not valid', 'default error msg')
        .serialize();

      expect(rules.length).toBeDefined();
      expect(rules.length?.tokenizer).toEqual(tok);
      expect(rules.length?.notValid).toBe('not valid');
      expect(rules.length?.message).toBe('default error msg');
    });
  });

  describe('length', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .length(5, 'wrong')
        .serialize();

      expect(rules.length).toBeDefined();
      expect(rules.length?.is).toBe(5);
      expect(rules.length?.wrongLength).toBe('wrong');
    });
  });

  describe('minLength', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .minLength(5, 'wrong')
        .serialize();

      expect(rules.length).toBeDefined();
      expect(rules.length?.minimum).toBe(5);
      expect(rules.length?.tooShort).toBe('wrong');
    });
  });

  describe('maxLength', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .maxLength(5, 'wrong')
        .serialize();

      expect(rules.length).toBeDefined();
      expect(rules.length?.maximum).toBe(5);
      expect(rules.length?.tooLong).toBe('wrong');
    });
  });

  describe('number', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .number('wrong', true, 'default msg')
        .serialize();

      expect(rules.numericality?.strict).toBe(true);
      expect(rules.numericality?.notValid).toBe('wrong');
      expect(rules.numericality?.message).toBe('default msg');
    });
  });

  describe('integer', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .integer('wrong')
        .serialize();

      expect(rules.numericality?.onlyInteger).toBe(true);
      expect(rules.numericality?.notInteger).toBe('wrong');
    });
  });

  describe('double', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .double()
        .serialize();

      expect(rules.numericality?.onlyInteger).toBe(false);
    });
  });

  describe('greaterThan', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .greaterThan(6, 'wrong')
        .serialize();

      expect(rules.numericality?.greaterThan).toBe(6);
      expect(rules.numericality?.notGreaterThan).toBe('wrong');
    });
  });

  describe('greaterThanOrEquals', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .greaterThanOrEquals(6, 'wrong')
        .serialize();

      expect(rules.numericality?.greaterThanOrEqualTo).toBe(6);
      expect(rules.numericality?.notGreaterThanOrEqualTo).toBe('wrong');
    });
  });

  describe('equals', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .equals(6, 'wrong')
        .serialize();

      expect(rules.numericality?.equalTo).toBe(6);
      expect(rules.numericality?.notEqualTo).toBe('wrong');
    });
  });

  describe('lessThanOrEquals', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .lessThanOrEquals(6, 'wrong')
        .serialize();

      expect(rules.numericality?.lessThanOrEqualTo).toBe(6);
      expect(rules.numericality?.notLessThanOrEqualTo).toBe('wrong');
    });
  });

  describe('lessThan', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .lessThan(6, 'wrong')
        .serialize();

      expect(rules.numericality?.lessThan).toBe(6);
      expect(rules.numericality?.notLessThan).toBe('wrong');
    });
  });

  describe('divisibleBy', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .divisibleBy(6, 'wrong')
        .serialize();

      expect(rules.numericality?.divisibleBy).toBe(6);
      expect(rules.numericality?.notDivisibleBy).toBe('wrong');
    });
  });

  describe('odd', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .odd('wrong')
        .serialize();

      expect(rules.numericality?.odd).toBe(true);
      expect(rules.numericality?.notOdd).toBe('wrong');
    });
  });

  describe('even', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .even('wrong')
        .serialize();

      expect(rules.numericality?.even).toBe(true);
      expect(rules.numericality?.notEven).toBe('wrong');
    });
  });

  describe('required', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .required('wrong', true)
        .serialize();

      expect(rules.presence?.allowEmpty).toBe(true);
      expect(rules.presence?.message).toBe('wrong');
    });

    it('should set allowEmpty to false by default', () => {
      const rules = FD.rules()
        .required()
        .serialize();

      expect(rules.presence?.allowEmpty).toBe(false);
    });
  });

  describe('isType', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .isType('string', 'wrong')
        .serialize();
      rules.type = rules.type as ITypeMainRule;
      expect(rules.type?.type).toBe('string');
      expect(rules.type?.message).toBe('wrong');
    });
  });

  describe('url', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .url('wrong', [], false, true)
        .serialize();
      rules.url = rules.url as IURLMainRule;
      expect(rules.url?.message).toBe('wrong');
      expect(rules.url?.schemes).toEqual([]);
      expect(rules.url?.allowLocal).toBe(false);
      expect(rules.url?.allowDataUrl).toBe(true);
    });
  });

  describe('custom', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .custom(() => null)
        .serialize();
      expect(rules.custom).toBeDefined();
      expect(typeof rules.custom).toBe('function');
    });
  });

  describe('customAsync', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .customAsync(() => res => res())
        .serialize();
      expect(rules.customAsync).toBeDefined();
      expect(typeof rules.customAsync).toBe('function');
    });
  });

  describe('rawRules', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
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
