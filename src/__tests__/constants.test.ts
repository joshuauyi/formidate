import { ASYNC_RESET_INDICATOR, customAsyncTasks, validate } from '../constants';

// tslint:disable: no-string-literal

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
      describe('custom', () => {
        it('should return null if options is not set', () => {
          expect(validate.validators.custom('', null, 'name', { name: '' })).toBe(null);
        });

        it('should be defined', () => {
          expect(validate.validators.custom).toBeDefined();
        });
      });

      describe('customAsync', () => {
        it('should return null if syncValidateOnly is set to true', () => {
          expect(validate.validators.customAsync('', null, 'name', { name: '' }, { syncValidateOnly: true })).toBe(
            null,
          );
        });

        it('should be defined', () => {
          expect(validate.validators.customAsync).toBeDefined();
        });

        const options = jest.fn();
        const cus = validate.validators.customAsync('', options, 'name', { name: '' }, { instaceCount: 1 });
        it('should be instance of Promise', () => {
          expect(cus).toBeInstanceOf(validate.Promise);
        });

        it('should call options function', () => {
          expect(options).toBeCalled();
        });
      });

      it('should set equality default message', () => {
        expect(validate.validators.equality.message).toBeDefined();
        expect(typeof validate.validators.equality.message).toBe('string');
      });

      const { datetime } = validate.validators;

      it('should extend datetime rule', () => {
        expect(datetime?.parse).toBeDefined();
        expect(typeof datetime?.parse).toBe('function');
        expect(datetime?.format).toBeDefined();
        expect(typeof datetime?.format).toBe('function');
      });

      it('should parse string to timestamp', () => {
        expect(datetime?.parse('2020')).toBe(NaN);
        expect(typeof datetime?.parse('2020-10-20')).toBe('number');
      });

      it('should format datetime properly', () => {
        expect(datetime?.format(datetime?.parse('2020-10-20'), { dateOnly: true })).toBe('2020-10-20');
        expect(datetime?.format(datetime?.parse('2020-10-20'), { dateOnly: false })).toBe('2020-10-20 00:00:00');
        expect(datetime?.format(datetime?.parse('2020-10-20 13:30:45'), { dateOnly: false })).toBe(
          '2020-10-20 13:30:45',
        );
      });
    });
  });
});
