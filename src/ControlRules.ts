import { CustomAsyncRule, CustomRule, ExclusionMainRule, IFormRuleItem, IURLMainRule } from './models/control-rules';

/*!
 * Formidate
 *
 * (c) 2019 Joshua Uyi
 */

class ControlRules {
  private rules: IFormRuleItem = {};

  public isEmail(options: { message: string }) {
    this.rules.email = options ? options : true;
    return this;
  }

  public sameAs(controlName: string, message?: string, comparator?: (v1: any, v2: any) => any) {
    this.rules.equality = { attribute: controlName };
    if (message) {
      this.rules.equality.message = message;
    }
    if (comparator) {
      this.rules.equality.comparator = comparator;
    }
    return this;
  }

  public excludes(exclusions: ExclusionMainRule, message?: string) {
    this.rules.exclusion = { within: exclusions };
    if (message) {
      this.rules.exclusion.message = message;
    }
    return this;
  }

  public matches(pattern: string, flags?: string, message?: string) {
    this.rules.format = { pattern };
    if (flags) {
      this.rules.format.flags = flags;
    }
    if (message) {
      this.rules.format.message = message;
    }
    return this;
  }

  public includes(inclusions: ExclusionMainRule, message?: string) {
    this.rules.inclusion = { within: inclusions };
    if (message) {
      this.rules.inclusion.message = message;
    }
    return this;
  }

  // length

  public length(length: number, message?: string) {
    if (!this.rules.length) {
      this.rules.length = {};
    }

    this.rules.length.is = length;
    if (message) {
      this.rules.length.wrongLength = message;
    }
    return this;
  }

  public minLength(length: number, message?: string) {
    if (!this.rules.length) {
      this.rules.length = {};
    }

    this.rules.length.minimum = length;
    if (message) {
      this.rules.length.tooShort = message;
    }
    return this;
  }

  public maxLength(length: number, message?: string) {
    if (!this.rules.length) {
      this.rules.length = {};
    }

    this.rules.length.maximum = length;
    if (message) {
      this.rules.length.tooLong = message;
    }
    return this;
  }

  public overideLenghtMessage(message: string) {
    if (!this.rules.length) {
      this.rules.length = {};
    }

    this.rules.length.message = message;
    return this;
  }

  // numericality

  public isInteger(message?: string) {
    if (!this.rules.numericality) {
      this.rules.numericality = {};
    }

    this.rules.numericality.onlyInteger = true;
    if (message) {
      this.rules.numericality.notInteger = message;
    }
    return this;
  }

  public useStrictNumerics() {
    if (!this.rules.numericality) {
      this.rules.numericality = {};
    }

    this.rules.numericality.strict = true;
    return this;
  }

  public greaterThan(value: number, message?: string) {
    if (!this.rules.numericality) {
      this.rules.numericality = {};
    }

    this.rules.numericality.greaterThan = value;
    if (message) {
      this.rules.numericality.notGreaterThan = message;
    }
    return this;
  }

  public greaterThanOrEquals(value: number, message?: string) {
    if (!this.rules.numericality) {
      this.rules.numericality = {};
    }

    this.rules.numericality.greaterThanOrEqualTo = value;
    if (message) {
      this.rules.numericality.notGreaterThanOrEqualTo = message;
    }
    return this;
  }

  public equals(value: number, message?: string) {
    if (!this.rules.numericality) {
      this.rules.numericality = {};
    }

    this.rules.numericality.equalTo = value;
    if (message) {
      this.rules.numericality.notEqualTo = message;
    }
    return this;
  }

  public lessThanOrEquals(value: number, message?: string) {
    if (!this.rules.numericality) {
      this.rules.numericality = {};
    }

    this.rules.numericality.lessThanOrEqualTo = value;
    if (message) {
      this.rules.numericality.notLessThanOrEqualTo = message;
    }
    return this;
  }

  public lessThan(value: number, message?: string) {
    if (!this.rules.numericality) {
      this.rules.numericality = {};
    }

    this.rules.numericality.lessThan = value;
    if (message) {
      this.rules.numericality.notLessThan = message;
    }
    return this;
  }

  public divisibleBy(value: number, message?: string) {
    if (!this.rules.numericality) {
      this.rules.numericality = {};
    }

    this.rules.numericality.divisibleBy = value;
    if (message) {
      this.rules.numericality.notDivisibleBy = message;
    }
    return this;
  }

  public odd(message?: string) {
    if (!this.rules.numericality) {
      this.rules.numericality = {};
    }

    this.rules.numericality.odd = true;
    if (message) {
      this.rules.numericality.notOdd = message;
    }
    return this;
  }

  public even(message?: string) {
    if (!this.rules.numericality) {
      this.rules.numericality = {};
    }

    this.rules.numericality.even = true;
    if (message) {
      this.rules.numericality.notEven = message;
    }
    return this;
  }

  public overideNumericalityMessage(message: string) {
    if (!this.rules.numericality) {
      this.rules.numericality = {};
    }

    this.rules.numericality.message = message;
    return this;
  }

  public required(message?: string | null, allowEmpty?: boolean) {
    this.rules.presence = {
      allowEmpty: allowEmpty === undefined ? false : allowEmpty,
      message: message ? message : undefined,
    };
    return this;
  }

  public isType(type: string, message?: string) {
    this.rules.type = {
      type,
      message: message ? message : undefined,
    };
    return this;
  }

  public url(config?: IURLMainRule) {
    this.rules.url = config ? config : true;
    return this;
  }

  public custom(func: CustomRule) {
    this.rules.custom = func;
    return this;
  }

  public customAsync(func: CustomAsyncRule) {
    this.rules.customAsync = func;
    return this;
  }

  public rawRules(rules: IFormRuleItem) {
    this.rules = rules;
    return this;
  }

  public serialize() {
    return this.rules;
  }
}

export default ControlRules;
