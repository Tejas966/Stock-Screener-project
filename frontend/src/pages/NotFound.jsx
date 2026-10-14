import { Link } from 'react-router-dom';
import SearchBar from '../components/SearchBar.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export default function NotFound({ message = 'The page you were looking for does not exist or has moved.' }) {
  useDocumentTitle('Page not found');
  return (
    <div className="container page" style={{ maxWidth: 640 }}>
      <p className="eyebrow">Error 404</p>
      <h1>Not found</h1>
      <p className="lead">{message}</p>
      <SearchBar />
      <p style={{ marginTop: 'var(--space-4)' }}><Link to="/">Go to the home page</Link> · <Link to="/search">Search companies</Link></p>
    </div>
  );
}
