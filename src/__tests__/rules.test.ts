import Formidate from '..';
import FormGroup from '../FormGroup';

const FD = Formidate;

//   const group: FormGroup = FD.group({
//     age: FD.control(FD.rules().date()),
//   });

//   group.render(isValid => {
//     expect(isValid).toBeTruthy();
//     done();
//   });
//   validator.validate({ target: { name: 'username', value: 'Jane' } });

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
});
