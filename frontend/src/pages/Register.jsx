import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { serverFieldErrors, validateEmail, validateName, validatePassword } from '../utils/validation.js';

export function validateRegistration(form) {
  const errors = {};
  const n = validateName(form.name);
  const e = validateEmail(form.email);
  const p = validatePassword(form.password);
  if (n) errors.name = n;
  if (e) errors.email = e;
  if (p) errors.password = p;
  if (!form.password_confirmation) errors.password_confirmation = 'Please confirm your password';
  else if (form.password !== form.password_confirmation) errors.password_confirmation = 'Passwords do not match';
  return errors;
}

export default function Register() {
  useDocumentTitle('Create account');
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '', password_confirmation: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const from = typeof location.state?.from === 'string' && location.state.from.startsWith('/') ? location.state.from : '/watchlist';

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    const v = validateRegistration(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    setFormError(null);
    try {
      await register({ ...form, name: form.name.trim(), email: form.email.trim() });
      navigate(from, { replace: true });
    } catch (err) {
      setErrors(serverFieldErrors(err));
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page auth-page">
      <div className="card">
        <h1>Create an account</h1>
        <p className="muted">Free account for saving your research. We only store your name, email and a salted password hash.</p>
        <form className="form" onSubmit={submit} noValidate>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <FormField label="Full name" error={errors.name} required><input className="input" autoComplete="name" value={form.name} onChange={set('name')} maxLength={120} /></FormField>
          <FormField label="Email" error={errors.email} required><input className="input" type="email" autoComplete="email" value={form.email} onChange={set('email')} /></FormField>
          <FormField label="Password" error={errors.password} required hint="At least 8 characters, including a letter and a digit.">
            <input className="input" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
          </FormField>
          <FormField label="Confirm password" error={errors.password_confirmation} required>
            <input className="input" type="password" autoComplete="new-password" value={form.password_confirmation} onChange={set('password_confirmation')} />
          </FormField>
          <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        </form>
        <p className="small" style={{ marginTop: 'var(--space-4)' }}>Already registered? <Link to="/login" state={location.state}>Log in</Link></p>
      </div>
    </div>
  );
}
