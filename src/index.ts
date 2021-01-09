/*!
 * Formidate
 *
 * (c) 2019 Joshua Uyi
 */

import { validate } from './constants';
import ControlRules from './Constrain';
import FormGroup from './FormGroup';
import { IConstrainsMap } from './models/models';

interface IFormidateObject {
  group: (controls: IConstrainsMap, prependName?: boolean) => FormGroup;
  constrain: (defaultValue?: string | null) => ControlRules;
  /** @deprecated make use of constrain */
  control: (rules: ControlRules, defaultValue?: string | null) => ControlRules;
  /** @deprecated */
  rules: () => ControlRules;
  addCustomType: (name: string, resolver: (value: any) => boolean) => void;
}

type FWindow = typeof window & {
  Formidate: IFormidateObject;
};

const Formidate: IFormidateObject = {
  group: (controls, prependName = true) => new FormGroup(controls, prependName),
  constrain: (defaultValue = null) => new ControlRules(defaultValue),
  // TODO: remove in future upgrade
  control: (rules, defaultValue = null) => new ControlRules(defaultValue).rawRules(rules.serialize()),
  // TODO: remove in future upgrade
  rules: () => new ControlRules(),
  addCustomType: (name: string, resolver: (value: any) => boolean) => {
    validate.validators.type.types[name] = resolver;
  },
};

(window as FWindow).Formidate = Formidate;

export default Formidate;
