import { ASYNC_RESET_INDICATOR, validate } from '../constants';

describe('constants', () => {
  describe('ASYNC_RESET_INDICATOR', () => {
    it('should set passed properties', () => {
      expect(ASYNC_RESET_INDICATOR.key).toBeDefined();
    });
  });

  describe('validate', () => {
    describe('Promise', () => {
      it('should be defined', () => {
        expect(validate.Promise).toBeDefined();
      });
    });

    describe('validators', () => {
      it('should be defined with custom rules', () => {
        expect(validate.validators.custom).toBeDefined();
        expect(validate.validators.customAsync).toBeDefined();
      });

      it('should set equality default message', () => {
        expect(validate.validators.equality.message).toBeDefined();
        expect(typeof validate.validators.equality.message).toBe('string');
      });

      it('should extend datetime rule', () => {
        const { datetime } = validate.validators;
        expect(datetime?.parse).toBeDefined();
        expect(typeof datetime?.parse).toBe('function');
        expect(datetime?.format).toBeDefined();
        expect(typeof datetime?.format).toBe('function');
      });
    });
  });
});
