import ControlRules from './ControlRules';
import FormControl from './FormControl';
import FormGroup from './FormGroup';
import { IFormControlsMap, IFormidateOptions } from './models/models';

interface IFormidateObject {
  group: (controls: IFormControlsMap, options?: IFormidateOptions) => FormGroup;
  control: (rules: ControlRules, defaultValue?: string | null) => FormControl;
  rules: () => ControlRules;
}

type FWindow = typeof window & {
  Formidate: IFormidateObject;
};

const Formidate: IFormidateObject = {
  group: (controls: IFormControlsMap, options?: IFormidateOptions) => {
    return new FormGroup(controls, options);
  },
  control: (rules, defaultValue) => {
    const ctr = new FormControl(defaultValue || null, rules);
    return ctr;
  },
  rules: () => new ControlRules(),
};

(window as FWindow).Formidate = Formidate;

export default Formidate;
