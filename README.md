# Formidate

Formidate is a form validation library, for validating web client forms.

## Introduction

Formidate was created to give an effective yet convenient way of validating forms (in react components and html). The library is flexible and gives you control of its effects including what errors are shown, styling, and flow.
_Scroll to the bottom of this page to see a sample react component with form validation_

## Requirements

- Node and npm
- Transpilation (conventionally with babel). [create-react-app](https://github.com/facebook/create-react-app) has this setup already.

## Installation

    npm install formidate

## Dependency

formidate relies on [validate.js](https://github.com/ansman/validate.js) for its validation rules and is shipped together with the library.

## Usage

_The examples in this doc are targeted for react however, the principles can be applied to forms using other tools including vanilla JS_

#### Validating forms

- **Import Formidate to your js code**

```javascript
import Formidate from 'formidate';
```

- **Create a constant as a reference to Formidate FormGroup**

```javascript
const validator = Formidate.group(<controls>, <prependName>);
```

> **controls** is an object of all validation controls created with `Formidate.control(<rules>, <defaultValue>);`
> 
> **Note**: Formidate uses [validate.js](https://github.com/ansman/validate.js) under the hood and all rules are abstractions of the library, access validate.js docs [here](https://validatejs.org/#validators). Formidate provides **custom** and **customAsync** as additional rules. Also all the rules are accessed as methods using Formidate as shown the the example

```javascript
const controls = {
  username: Formidate.control(Formidate.rules().required()),
  password: Formidate.control(
    Formidate.rules().required().minLength(8),
  ),
};
```

> **prependName** _(optional)_ is a boolean which indicates if that the control name should be prepended to the error messages or not, this is `true` by default. You can still prevent the name from being prepended even if set to true by prepending `^` to the error message.

#### custom and customAsync constriants
custom and customAsync rules both take a function with arguments `(value, values, controlName)`

with the custom rule, validation is based on your specified conditions, simply return a `string` of the error message if validation fails or null if validation passes. The `custom` rule can be used on a control not associated with any input, provided it is the only rule specified on the control

customAsync rule makes you perform validation asynchronously, this is useful if you need to call endpoint or perform some other asynchronous task to validate a field. To do this, customAsync should return a function taking resolve as an argument, resolve should be called to indicate validation is done passing in the validation error `string` or without any argument if the validation passes.

**Sample custom and customAsync rules are shown below**

```javascript
const controls = {
  username: Formidate.control(
    Formidate.rules().customAsync((value, values, controlName) => {
        return (resolve) => {
          if ((value || "").trim() === "") return resolve();

          setTimeout(() => {
            if (["joshua", "john", "rita"].includes(value)) {
              resolve("%{value} is taken");
            } else {
              resolve();
            }
          }, 1000);
        };
      })
  ),
  unique: Formidate.control(
    Formidate.rules().custom((value, values, controlName) => {
      if (values.username === values.password) {
        return "^the username and password cannot be thesame";
      }
      return null;
    })
  ),
};
```

- **Using the validator**

Ensure the name of the input field corresponds to the object key of the validation control otherwise, the validator control would not be associated with an input field and would be discarded unless it meets the condition to act as a stand-alone custom validator as stated above.

```javascript
<input type="text" name="username" />
```

If for any reason the name given to the input does not match the validation constraint key, use the `formidate-control` or `data-formidate-control` attribute on the input element to specify the constrian key the input is associated with.

```javascript
<input type="text" name="alt-input-name" formidate-control="username" />
```

> Formidate FormGroup instance has a controls property `validator.controls` that holds the control object of each field. The control object has three important fields
>
> - **errors** - an array holding all validation errors of the field
> - **touched** - indicating if the control field has been interacted with
> - **loading** - indicating if an asynchronous validation is processing

getting a reference to a control associated with a field can be done thus

```javascript
const usernameControl = validator.controls.username;
// OR
const usernameControl = validator.get('username');
```

The errors, touched, loading and other properties and methods of the control can be access from the control object directly

```javascript
const usernameErrors = validator.controls.username.errors;

const usernameTouched = validator.controls.username.touched;
```

The errors can be displayed in a react app as follows

```javascript
<div>{usernameTouched && usernameErrors.map((error, i) => <div key={i}>{error}</div>)}</div>
```

> the _touched_ check should be done, otherwise errors would show up without the user interacting with the form unless if this is desired.

**Validating a form**
To validate input values in a form, add an onChange listener to the form and call the validate method in its callback passing the event.

  > **Note:** Other listeners e.g. onBlur can be used to perform validation at the occurence of corresponding events.

```javascript
onChange = event => {
  // Note: in a react app, the event should be the native event which can be gotten with event.nativeEvent
  validator.validate(event.nativeEvent);
};
```

A check can also be added on submit of the form, in case the user tends to bypass onchange validation. 
Conventionally, all errors should show up after submitting the form, this can be done by calling the `validator.touchAll()` function in the onsubmit handler. This forces all controls to be touched.

```javascript
onSubmit  = (event) => {
  event.preventDefault();
  if (!validator.valid()) {
    validator.touchAll();
    return;
  }
  // ...
}
```

### Custom and Variable controls

You may need to include custom contraints later on in your code, luckily, Formidator provides a means to accomplish this, you can always add controls using the `validator.addControls` function and remove existing ones with `validator.removeControls` at appropriate places in your code

validator.addControls takes in **controls** as an argument which is an object mapping controls names and the control `(gender: Formidate.control}`
validator.removeControl takes in a variable list of **controlNames**

```javascript
validator.addControls({
  'new-control': Formidate.control(Formidate.rules().required(), 'default-value')
});
// ...
validator.removeControls('existing-control', 'another-control');
```

### Rendering Validation Errors
To display validation errors on your view, call the `validator.render(callback)` function. The callback is a function which takes `valid` and `controls` as arguments and its body should be the logic to render errors to the screen, Call to `validator.render` can be done immediately after creating the validator instance.
```javascript
// the valid argument indicates if the form is valid or not, and controls is a collection of all form controls
validator.render((valid, controls) => {
  // perform logic to display errors to the users here.
  // in a react app this can be as easy as setting the state to trigger a rerender.
  // for a regular html form, certain elements can be updated to contain the validation error in controls
  this.setState({});
});
```

#### See an example of full react component with form validation below

```jsx harmony
import React from "react";
import Formidate from "formidate";

class Component extends React.Component {
  constructor(props) {
    super(props);

    const controls = {
      username: Formidate.control(
        Formidate.rules()
          .required()
          .customAsync((value, values, controlName) => {
            return (resolve) => {
              if ((value || "").trim() === "") return resolve();

              setTimeout(() => {
                if (["joshua", "john", "rita"].includes(value)) {
                  resolve("%{value} is taken");
                } else {
                  resolve();
                }
              }, 1000);
            };
          })
      ),
      password: Formidate.control(
        Formidate.rules()
          .required()
          .minLength(8)
      ),
      // custom validation can work on controls not associate with an input field on the condition that it is the only rule specified
      unique: Formidate.control(
        Formidate.rules().custom((value, values, controlName) => {
          if (values.username === values.password) {
            return "^the username and password cannot be thesame";
          }
          return null;
        })
      ),
    };
    this.validator = Formidate.group(controls);
    this.validator.render((valid, controls) => {
      // rerender validation errors and perform actions after validation
      this.setState({});
    });
  }

  render() {
    // destructure out the controls property
    const { controls } = this.validator;

    return (
      <div>
        <form
          onChange={this.validateForm}
          onSubmit={this.onSubmit}
          autoComplete="off"
        >
          <label style={{ display: "block" }}>Username</label>
          <input type="text" name="username" />
          {/* display loader if username control is loading or all username errors if field is touched */}
          {controls.username.loading ? (
            <div>checking...</div>
          ) : (
            <div>
              {controls.username.touched &&
                controls.username.errors.map((error, i) => (
                  <div key={i}>{error}</div>
                ))}
            </div>
          )}
          <label style={{ display: "block" }}>Password</label>
          <input type="password" name="password" />
          {/* display first password error at all times if any exists */}
          <div>{controls.password.errors[0]}</div>
          <div>{controls.unique.touched && controls.unique.errors[0]}</div>
          {/* disable submit button based on the form valid state */}
          <button disabled={!this.validator.valid()}>Submit</button>
        </form>
      </div>
    );
  }

  validateForm = (event) => {
    // get nativeEvent out of the react change event.
    this.validator.validate(event.nativeEvent);
  };

  onSubmit = (event) => {
    event.preventDefault();
    if (!this.validator.valid) {
      this.validator.touchAll();
      return;
    }
    // ...
  };
}

export default Component;
```
