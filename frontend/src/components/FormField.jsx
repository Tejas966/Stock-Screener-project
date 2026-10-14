import { AlertCircle } from 'lucide-react';
import { cloneElement, useId } from 'react';

/**
 * Label + control + hint + error, wired with aria-describedby / aria-invalid
 * so screen readers announce validation messages.
 */
export default function FormField({ label, hint, error, children, required }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [hint && hintId, error && errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
      {cloneElement(children, { id, 'aria-describedby': describedBy, 'aria-invalid': error ? 'true' : undefined, 'aria-required': required || undefined })}
      {hint && <span id={hintId} className="hint">{hint}</span>}
      {error && <span id={errId} className="field-error" role="alert"><AlertCircle size={14} aria-hidden="true" style={{ marginTop: 3 }} />{error}</span>}
    </div>
  );
}
