import { validate } from '../constants';
import Formidate from '../index';

describe('Formidate', () => {
  describe('addCustomType', () => {
    it('should add a new custom type', () => {
      Formidate.addCustomType('even', (v) => v % 2 === 0);
      expect(validate.validators.type.types.even).toBeDefined();
      expect(typeof validate.validators.type.types.even).toBe('function');
    });
  });
});
