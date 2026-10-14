/** Client-side validation rules. The server re-validates everything. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(v) {
  if (!v.trim()) return 'Email is required';
  if (!EMAIL_RE.test(v.trim())) return 'Enter a valid email address';
  return null;
}

export function validatePassword(v) {
  if (!v) return 'Password is required';
  if (v.length < 8) return 'Password must be at least 8 characters';
  if (v.length > 128) return 'Password is too long';
  if (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v)) return 'Password must contain at least one letter and one digit';
  return null;
}

export function validateName(v) {
  const t = v.trim();
  if (t.length < 2) return 'Name must be at least 2 characters';
  if (t.length > 100) return 'Name is too long';
  return null;
}

export function validateLength(v, { label, min = 1, max }) {
  const len = v.trim().length;
  if (len < min) return `${label} is required`;
  if (max && len > max) return `${label} must be at most ${max} characters`;
  return null;
}

/** Map server `details` ({field: message}) onto form errors. */
export function serverFieldErrors(err) {
  return err?.details && typeof err.details === 'object' ? err.details : {};
}
