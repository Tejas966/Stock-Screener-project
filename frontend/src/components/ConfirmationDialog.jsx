import { useEffect, useRef } from 'react';

/**
 * Accessible confirmation built on the native <dialog> element (focus is
 * trapped by the browser and Escape closes it).
 */
export default function ConfirmationDialog({ open, title, children, confirmLabel = 'Confirm', danger = false, busy = false, onConfirm, onCancel }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close?.();
  }, [open]);
  return (
    <dialog ref={ref} className="dialog" aria-labelledby="confirm-title" onCancel={(e) => { e.preventDefault(); onCancel(); }}>
      {open && (
        <>
          <h2 id="confirm-title">{title}</h2>
          <div className="small">{children}</div>
          <div className="btn-row" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
            <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={busy}>Cancel</button>
            <button type="button" className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} onClick={onConfirm} disabled={busy} autoFocus>
              {busy ? 'Working…' : confirmLabel}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
