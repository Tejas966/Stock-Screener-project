import { useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { api } from '../services/api.js';
import { formatDate } from '../utils/format.js';
import { serverFieldErrors, validateName, validatePassword } from '../utils/validation.js';

export default function Profile() {
  useDocumentTitle('Profile');
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: user.name, preferred_period: user.preferred_period, preferred_unit: user.preferred_unit });
  const [pState, setPState] = useState({ errors: {}, message: null, error: null, busy: false });
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwState, setPwState] = useState({ errors: {}, message: null, error: null, busy: false });

  const saveProfile = async (e) => {
    e.preventDefault();
    const n = validateName(form.name);
    if (n) return setPState({ errors: { name: n }, message: null, error: null, busy: false });
    setPState({ errors: {}, message: null, error: null, busy: true });
    try {
      const u = await api.updateProfile({ ...form, name: form.name.trim() });
      setUser(u);
      setPState({ errors: {}, message: 'Profile saved.', error: null, busy: false });
    } catch (err) {
      setPState({ errors: serverFieldErrors(err), message: null, error: err.message, busy: false });
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!pw.current_password) errors.current_password = 'Enter your current password';
    const p = validatePassword(pw.new_password);
    if (p) errors.new_password = p;
    if (pw.new_password !== pw.confirm) errors.confirm = 'Passwords do not match';
    if (Object.keys(errors).length) return setPwState({ errors, message: null, error: null, busy: false });
    setPwState({ errors: {}, message: null, error: null, busy: true });
    try {
      await api.changePassword({ current_password: pw.current_password, new_password: pw.new_password });
      setPw({ current_password: '', new_password: '', confirm: '' });
      setPwState({ errors: {}, message: 'Password changed. Other devices have been signed out.', error: null, busy: false });
    } catch (err) {
      setPwState({ errors: serverFieldErrors(err), message: null, error: err.message, busy: false });
    }
  };

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Profile' }]} />
      <header className="page-header"><h1>Your profile</h1></header>
      <div className="grid grid--2">
        <section className="card" aria-labelledby="acct">
          <h2 id="acct" style={{ fontSize: 'var(--text-xl)' }}>Account &amp; preferences</h2>
          <dl className="kv" style={{ marginBottom: 'var(--space-4)' }}>
            <dt>Email</dt><dd>{user.email}</dd>
            <dt>Member since</dt><dd>{formatDate(user.created_at)}</dd>
          </dl>
          <form className="form" onSubmit={saveProfile} noValidate>
            {pState.error && <p className="form-error" role="alert">{pState.error}</p>}
            <FormField label="Name" error={pState.errors.name} required><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
            <FormField label="Default statement period" hint="Used when opening the income statement.">
              <select className="select" value={form.preferred_period} onChange={(e) => setForm({ ...form, preferred_period: e.target.value })}>
                <option value="annual">Annual</option><option value="quarterly">Quarterly</option>
              </select>
            </FormField>
            <FormField label="Amount unit" hint="How large rupee amounts are displayed.">
              <select className="select" value={form.preferred_unit} onChange={(e) => setForm({ ...form, preferred_unit: e.target.value })}>
                <option value="crore">Crore (₹ Cr)</option><option value="lakh">Lakh (₹ L)</option>
              </select>
            </FormField>
            <button type="submit" className="btn btn--primary" disabled={pState.busy}>{pState.busy ? 'Saving…' : 'Save profile'}</button>
            <p role="status" className="small change--pos mb-0">{pState.message}</p>
          </form>
        </section>
        <section className="card" aria-labelledby="pw">
          <h2 id="pw" style={{ fontSize: 'var(--text-xl)' }}>Change password</h2>
          <form className="form" onSubmit={changePassword} noValidate>
            {pwState.error && <p className="form-error" role="alert">{pwState.error}</p>}
            <FormField label="Current password" error={pwState.errors.current_password} required><input className="input" type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></FormField>
            <FormField label="New password" error={pwState.errors.new_password} required hint="At least 8 characters with a letter and a digit."><input className="input" type="password" autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></FormField>
            <FormField label="Confirm new password" error={pwState.errors.confirm} required><input className="input" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></FormField>
            <button type="submit" className="btn btn--secondary" disabled={pwState.busy}>{pwState.busy ? 'Updating…' : 'Change password'}</button>
            <p role="status" className="small change--pos mb-0">{pwState.message}</p>
          </form>
        </section>
      </div>
    </div>
  );
}
