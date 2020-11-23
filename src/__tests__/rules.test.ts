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
});
