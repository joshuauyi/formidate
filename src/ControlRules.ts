/*!
 * Formidate
 *
 * (c) 2019 Joshua Uyi
 */

import {
  CustomAsyncRule,
  CustomRule,
  ErroMessageType,
  ExclusionMainRule,
  IFormRuleItem,
  InclusionMainRule,
  IURLMainRule,
  LengthTokenizer,
} from './models/control-rules';

class ControlRules {
  private rules: IFormRuleItem = {};

  public date(dateOnly?: boolean, invalidDate?: ErroMessageType, overrideMessage?: ErroMessageType) {
    this.rules.datetime = this.rules.datetime || {};
    if (dateOnly !== undefined) {
      this.rules.datetime.dateOnly = dateOnly;
    }
    if (invalidDate) {
      this.rules.datetime.notValid = invalidDate;
    }
    if (overrideMessage) {
      this.rules.datetime.message = overrideMessage;
    }
    return this;
  }

  public beforeDate(date: any, message?: ErroMessageType) {
    this.rules.datetime = this.rules.datetime || {};
    this.rules.datetime.latest = date;
    if (message) {
      this.rules.datetime.tooLate = message;
    }
    return this;
  }

  public afterDate(date: any, message?: ErroMessageType) {
    this.rules.datetime = this.rules.datetime || {};
    this.rules.datetime.earliet = date;
    if (message) {
      this.rules.datetime.tooEarly = message;
    }
    return this;
  }

  public email(message?: ErroMessageType) {
    this.rules.email = message ? { message } : true;
    return this;
  }

  public sameAs(controlName: string, message?: ErroMessageType, comparator?: (v1: any, v2: any) => any) {
    this.rules.equality = { attribute: controlName };
    if (message) {
      this.rules.equality.message = message;
    }
    if (comparator) {
      this.rules.equality.comparator = comparator;
    }
    return this;
  }

  public excludes(exclusions: ExclusionMainRule, message?: ErroMessageType) {
    this.rules.exclusion = { within: exclusions };
    if (message) {
      this.rules.exclusion.message = message;
    }
    return this;
  }

  public matches(pattern: string | RegExp, flags?: string, message?: ErroMessageType) {
    this.rules.format = { pattern };
    if (flags) {
      this.rules.format.flags = flags;
    }
    if (message) {
      this.rules.format.message = message;
    }
    return this;
  }

  public includes(inclusions: InclusionMainRule, message?: ErroMessageType) {
    this.rules.inclusion = { within: inclusions };
    if (message) {
      this.rules.inclusion.message = message;
    }
    return this;
  }

  // length

  public lengthConfig(tokenizer?: LengthTokenizer, notValid?: ErroMessageType, overrideMessage?: ErroMessageType) {
    this.rules.length = this.rules.length || {};
    if (overrideMessage) {
      this.rules.length.message = overrideMessage;
    }
    if (notValid) {
      this.rules.length.notValid = notValid;
    }
    if (tokenizer) {
      this.rules.length.tokenizer = tokenizer;
    }

    return this;
  }

  public length(length: number, message?: ErroMessageType) {
    this.rules.length = this.rules.length || {};

    this.rules.length.is = length;
    if (message) {
      this.rules.length.wrongLength = message;
    }
    return this;
  }

  public minLength(length: number, message?: ErroMessageType) {
    this.rules.length = this.rules.length || {};

    this.rules.length.minimum = length;
    if (message) {
      this.rules.length.tooShort = message;
    }
    return this;
  }

  public maxLength(length: number, message?: ErroMessageType) {
    this.rules.length = this.rules.length || {};

    this.rules.length.maximum = length;
    if (message) {
      this.rules.length.tooLong = message;
    }
    return this;
  }

  // numericality

  public number(notValid?: ErroMessageType, useStrict?: boolean, overrideMessage?: ErroMessageType) {
    this.rules.numericality = this.rules.numericality || {};
    if (useStrict !== undefined) {
      this.rules.numericality.strict = useStrict;
    }
    if (notValid) {
      this.rules.numericality.notValid = notValid;
    }
    if (overrideMessage) {
      this.rules.numericality.message = overrideMessage;
    }

    return this;
  }

  public integer(message?: ErroMessageType) {
    this.rules.numericality = this.rules.numericality || {};
    this.rules.numericality.onlyInteger = true;
    if (message) {
      this.rules.numericality.notInteger = message;
    }
    return this;
  }

  public double() {
    this.rules.numericality = this.rules.numericality || {};
    this.rules.numericality.onlyInteger = false;
    return this;
  }

  public greaterThan(value: number, message?: ErroMessageType) {
    this.rules.numericality = this.rules.numericality || {};

    this.rules.numericality.greaterThan = value;
    if (message) {
      this.rules.numericality.notGreaterThan = message;
    }
    return this;
  }

  public greaterThanOrEquals(value: number, message?: ErroMessageType) {
    this.rules.numericality = this.rules.numericality || {};

    this.rules.numericality.greaterThanOrEqualTo = value;
    if (message) {
      this.rules.numericality.notGreaterThanOrEqualTo = message;
    }
    return this;
  }

  public equals(value: number, message?: ErroMessageType) {
    this.rules.numericality = this.rules.numericality || {};

    this.rules.numericality.equalTo = value;
    if (message) {
      this.rules.numericality.notEqualTo = message;
    }
    return this;
  }

  public lessThanOrEquals(value: number, message?: ErroMessageType) {
    this.rules.numericality = this.rules.numericality || {};

    this.rules.numericality.lessThanOrEqualTo = value;
    if (message) {
      this.rules.numericality.notLessThanOrEqualTo = message;
    }
    return this;
  }

  public lessThan(value: number, message?: ErroMessageType) {
    this.rules.numericality = this.rules.numericality || {};

    this.rules.numericality.lessThan = value;
    if (message) {
      this.rules.numericality.notLessThan = message;
    }
    return this;
  }

  public divisibleBy(value: number, message?: ErroMessageType) {
    this.rules.numericality = this.rules.numericality || {};

    this.rules.numericality.divisibleBy = value;
    if (message) {
      this.rules.numericality.notDivisibleBy = message;
    }
    return this;
  }

  public odd(message?: ErroMessageType) {
    this.rules.numericality = this.rules.numericality || {};

    this.rules.numericality.odd = true;
    if (message) {
      this.rules.numericality.notOdd = message;
    }
    return this;
  }

  public even(message?: ErroMessageType) {
    this.rules.numericality = this.rules.numericality || {};

    this.rules.numericality.even = true;
    if (message) {
      this.rules.numericality.notEven = message;
    }
    return this;
  }

  //

  public required(message?: ErroMessageType, allowEmpty?: boolean) {
    this.rules.presence = {
      allowEmpty: allowEmpty === undefined ? false : allowEmpty,
      message: message ? message : undefined,
    };
    return this;
  }

  public isType(type: string, message?: ErroMessageType) {
    this.rules.type = {
      type,
      message: message ? message : undefined,
    };
    return this;
  }

  public url(message?: ErroMessageType, schemes?: string[], allowLocal?: boolean, allowDataUrl?: boolean) {
    const config: IURLMainRule = { message, schemes, allowLocal, allowDataUrl };
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
