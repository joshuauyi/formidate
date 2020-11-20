import ControlRules from './ControlRules';
import FormControl from './FormControl';
import FormGroup from './FormGroup';
import { IFormControlsMap, IFormidateOptions } from './models/models';

interface IFormidateObject {
  group: (controls: IFormControlsMap, prependName: boolean) => FormGroup;
  control: (rules: ControlRules, defaultValue: string | null) => FormControl;
  rules: () => ControlRules;
}

type FWindow = typeof window & {
  Formidate: IFormidateObject;
};

const Formidate: IFormidateObject = {
  group: (controls, prependName = true) => new FormGroup(controls, prependName),
  control: (rules, defaultValue = null) => new FormControl(rules, defaultValue),
  rules: () => new ControlRules(),
};

(window as FWindow).Formidate = Formidate;

export default Formidate;
