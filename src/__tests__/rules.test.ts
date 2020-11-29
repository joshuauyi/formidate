import Formidate from '..';

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
      expect(rules.email?.message).toBe('must be after');
    });
  });

  describe('email', () => {
    it('should set passed properties', () => {
      const rules = FD.rules()
        .email('must be after')
        .serialize();
      expect(rules.email?.message).toBe('must be after');
    });

    it('should be set to empty object, if no message is passed', () => {
      const rules = FD.rules()
        .email()
        .serialize();
      expect(rules.email).toBeDefined();
      expect(typeof rules.email).toBe('object');
    });
  });

  describe('sameAs', () => {
    it('should set passed properties', () => {
      const comparator = (a: string, b: string) => a === b;
      const rules = FD.rules()
        .sameAs('pass', 'should be same as', comparator)
        .serialize();
      expect(rules.equality?.attribute).toBe('pass');
      expect(rules.equality?.message).toBe('should be same as');
      expect(rules.equality?.comparator).toBe(comparator);
    });
  });
});
