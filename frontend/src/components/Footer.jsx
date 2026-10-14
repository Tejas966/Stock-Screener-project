import { Link } from 'react-router-dom';
import { useMeta } from '../context/MetaContext.jsx';

export default function Footer() {
  const { meta } = useMeta();
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <section>
          <h2>FundamentalX</h2>
          <p>An educational tool for reading the financial fundamentals of NSE and BSE listed companies. Built as a Web Technology course project.</p>
          <p className="mb-0">Data source: {meta?.provider?.label ?? '…'}</p>
        </section>
        <nav aria-label="Research tools">
          <h2>Research</h2>
          <ul>
            <li><Link to="/search">Company search</Link></li>
            <li><Link to="/screener">Stock screener</Link></li>
            <li><Link to="/compare">Compare companies</Link></li>
            <li><Link to="/sectors">Sectors</Link></li>
            <li><Link to="/market">Market overview</Link></li>
          </ul>
        </nav>
        <nav aria-label="Learn">
          <h2>Learn</h2>
          <ul>
            <li><Link to="/methodology">Methodology</Link></li>
            <li><Link to="/glossary">Financial glossary</Link></li>
            <li><Link to="/lab/javascript-dom">JavaScript &amp; DOM lab</Link></li>
          </ul>
        </nav>
        <nav aria-label="Account">
          <h2>Your research</h2>
          <ul>
            <li><Link to="/watchlist">Watchlist</Link></li>
            <li><Link to="/saved-screens">Saved screens</Link></li>
            <li><Link to="/research-notes">Research notes</Link></li>
            <li><Link to="/history">Search history</Link></li>
          </ul>
        </nav>
      </div>
      <div className="container footer__legal">
        <p className="mb-0">
          <strong>Disclaimer:</strong> FundamentalX is for education only. It is not investment advice, not a recommendation to buy or sell any security,
          and not a brokerage. Figures may be delayed, incomplete or, in demo mode, entirely illustrative. AI-generated text can be wrong.
          Always verify with company filings and consult a SEBI-registered adviser before investing.
        </p>
      </div>
    </footer>
  );
}
