export default function Pagination({ page, pages, total, onPage, label = 'results' }) {
  if (pages <= 1) return <p className="pagination muted">{total} {label}</p>;
  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="muted">{total} {label} · page {page} of {pages}</span>
      <div className="btn-row">
        <button type="button" className="btn btn--secondary btn--sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button type="button" className="btn btn--secondary btn--sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </nav>
  );
}
