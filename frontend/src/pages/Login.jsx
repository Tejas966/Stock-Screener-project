import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { validateEmail } from '../utils/validation.js';

export default function Login() {
  useDocumentTitle('Log in');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const from = typeof location.state?.from === 'string' && location.state.from.startsWith('/') ? location.state.from : '/';

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    const em = validateEmail(form.email);
    if (em) v.email = em;
    if (!form.password) v.password = 'Password is required';
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    setFormError(null);
    try {
      await login(form.email.trim(), form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setFormError(err.status === 429 ? err.message : err.code === 'INVALID_CREDENTIALS' ? 'Email or password is incorrect.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page auth-page">
      <div className="card">
        <h1>Log in</h1>
        <p className="muted">Access your watchlist, saved screens, research notes and AI explanations.</p>
        <form className="form" onSubmit={submit} noValidate>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <FormField label="Email" error={errors.email} required>
            <input className="input" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
          </FormField>
          <FormField label="Password" error={errors.password} required>
            <input className="input" type="password" autoComplete="current-password" value={form.password} onChange={set('password')} />
          </FormField>
          <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        </form>
        <p className="small" style={{ marginTop: 'var(--space-4)' }}>New here? <Link to="/register" state={location.state}>Create an account</Link></p>
      </div>
    </div>
  );
}
