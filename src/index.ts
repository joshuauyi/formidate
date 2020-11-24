import { validate } from './constants';
import ControlRules from './ControlRules';
import FormControl from './FormControl';
import FormGroup from './FormGroup';
import { IFormControlsMap, IFormidateOptions } from './models/models';

interface IFormidateObject {
  group: (controls: IFormControlsMap, prependName?: boolean) => FormGroup;
  control: (rules: ControlRules, defaultValue?: string | null) => FormControl;
  rules: () => ControlRules;
  addCustomType: (name: string, resolver: (value: any) => boolean) => void;
}

type FWindow = typeof window & {
  Formidate: IFormidateObject;
};

const Formidate: IFormidateObject = {
  group: (controls, prependName = true) => new FormGroup(controls, prependName),
  control: (rules, defaultValue = null) => new FormControl(rules, defaultValue),
  rules: () => new ControlRules(),
  addCustomType: (name: string, resolver: (value: any) => boolean) => {
    validate.validators.type.types[name] = resolver;
  },
};

(window as FWindow).Formidate = Formidate;

export default Formidate;
