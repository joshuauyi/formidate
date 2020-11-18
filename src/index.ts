import ControlRules from './ControlRules';
import FormControl from './FormControl';
import FormGroup from './FormGroup';
import { IFormControlsMap, IFormidateOptions } from './models/models';

interface IFormidateObject {
  validator: (controls: IFormControlsMap, options?: IFormidateOptions) => FormGroup;
  control: (defaultValue: string, rules: ControlRules) => FormControl;
  rules: () => ControlRules;
}

type FWindow = typeof window & {
  Formidate: IFormidateObject;
};

const Formidate: IFormidateObject = {
  validator: (controls: IFormControlsMap, options?: IFormidateOptions) => {
    return new FormGroup(controls, options);
  },
  control: (defaultValue, rules) => {
    const ctr = new FormControl(defaultValue);
    ctr.setRules(rules);
    return ctr;
  },
  rules: () => new ControlRules(),
};

(window as FWindow).Formidate = Formidate;

export default Formidate;
