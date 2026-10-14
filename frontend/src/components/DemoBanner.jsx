import { FlaskConical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMeta } from '../context/MetaContext.jsx';
import { formatDate } from '../utils/format.js';

/** Persistent site-wide notice whenever the illustrative demo provider is active. */
export default function DemoBanner() {
  const { meta } = useMeta();
  if (!meta?.provider?.is_demo) return null;
  return (
    <div className="demo-banner" role="note">
      <div className="container">
        <FlaskConical size={16} aria-hidden="true" />
        <span>
          <strong>Demo mode:</strong> all prices and financial figures are <strong>illustrative</strong> (generated, not real company data; prices as of {formatDate(meta.provider.demo_as_of)}).{' '}
          <Link to="/methodology#data-sources">How data works</Link>
        </span>
      </div>
    </div>
  );
}
