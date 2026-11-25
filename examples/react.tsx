import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { field } from '../src/index';
import { useForm } from '../src/react/index';

const taken = ['joshua', 'admin'];
const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(signal.reason);
    });
  });

function FieldError({ control }: { control: { touched: boolean; error: string | null } }) {
  return <p className="error">{control.touched ? control.error : null}</p>;
}

function Signup() {
  const [submitted, setSubmitted] = useState<unknown>(null);
  // Phone rows are plain React state; the form notices rows React adds or removes by itself.
  const [phoneRows, setPhoneRows] = useState([1]);
  const nextRow = useRef(2);
  const { ref, handleSubmit, controls, values, valid, pending, submitting, form } = useForm({
    username: field()
      .label('Username')
      .required()
      .minLength(3)
      .async(
        async (value, { signal }) => {
          await wait(600, signal);
          return taken.includes(value.toLowerCase()) ? `"${value}" is taken` : null;
        },
        { debounce: 300 },
      ),
    email: field().label('Email').required().email(),
    role: field('user').oneOf(['user', 'admin']).required(),
    password: field().label('Password').required().minLength(8),
    confirm: field().label('Confirmation').required().sameAs('password'),
    // Each row's rules come from its HTML attributes; this adds the list-level rule.
    phones: field().label('Phone numbers').array().minItems(1, 'Add at least one phone number'),
  });
  const phonesListError = controls.phones.issues.find((issue) => issue.path.length === 0);

  return (
    <form
      ref={ref}
      onSubmit={handleSubmit(async (values) => {
        await wait(400);
        // values is typed: { username: string; email: string; role: 'user' | 'admin'; … }
        setSubmitted(values);
      })}
    >
      <h1>React: useForm</h1>
      <p className="lead">
        Uncontrolled inputs + <code>ref</code>. Errors render from the hook's snapshot; the phone rows use
        error slots, which track each row's touched state. Taken usernames: joshua, admin.
      </p>
      <div className="field">
        <label htmlFor="r-username">Username</label>
        <input id="r-username" name="username" autoComplete="off" />
        <span className="hint">{controls.username.pending ? 'Checking…' : ''}</span>
        <FieldError control={controls.username} />
      </div>
      <div className="field">
        <label htmlFor="r-email">Email</label>
        <input id="r-email" name="email" type="email" />
        <FieldError control={controls.email} />
      </div>
      <div className="field">
        <label htmlFor="r-role">Role</label>
        <select id="r-role" name="role">
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="r-password">Password</label>
        <input id="r-password" name="password" type="password" />
        <FieldError control={controls.password} />
      </div>
      <div className="field">
        <label htmlFor="r-confirm">Confirm password</label>
        <input id="r-confirm" name="confirm" type="password" />
        <FieldError control={controls.confirm} />
      </div>
      <fieldset>
        <legend>Phone numbers</legend>
        <div className="list" data-empty="No phone numbers">
          {phoneRows.map((id) => (
            <div className="item" key={id}>
              <input
                name="phones[]"
                type="tel"
                required
                pattern="\+?[0-9 ]{7,20}"
                aria-label="Phone"
                placeholder="+1 555 123 4567"
              />
              <button
                type="button"
                className="remove"
                onClick={() => setPhoneRows((rows) => rows.filter((row) => row !== id))}
              >
                Remove
              </button>
              {/* Empty slot: Formidate fills it with this row's error (React never renders into it). */}
              <p className="error" data-formidate-error="phones[]" />
            </div>
          ))}
        </div>
        <p className="error">{controls.phones.touched ? phonesListError?.message : null}</p>
        <button
          type="button"
          className="add"
          onClick={() => setPhoneRows((rows) => [...rows, nextRow.current++])}
        >
          + Add phone
        </button>
      </fieldset>
      <button type="button" onClick={() => form.reset()} style={{ background: '#e5e7eb', color: '#374151' }}>
        Reset
      </button>{' '}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit'}
      </button>
      <h2>State</h2>
      <pre>{JSON.stringify({ valid, pending, submitting, phones: values.phones, submitted }, null, 2)}</pre>
    </form>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Signup />
  </StrictMode>,
);
