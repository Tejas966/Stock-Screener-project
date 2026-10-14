import { ChevronDown, Menu, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import SearchBar from './SearchBar.jsx';

const LINKS = [
  { to: '/market', label: 'Market' },
  { to: '/screener', label: 'Screener' },
  { to: '/compare', label: 'Compare' },
  { to: '/sectors', label: 'Sectors' },
  { to: '/methodology', label: 'Methodology' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const userRef = useRef(null);

  useEffect(() => { setMenuOpen(false); setUserOpen(false); }, [location.pathname]);
  useEffect(() => {
    const close = (e) => { if (!userRef.current?.contains(e.target)) setUserOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setUserOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, []);

  const doLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <Link to="/" className="brand" aria-label="FundamentalX home">
          <span aria-hidden="true">Fundamental<span className="brand__mark">X</span></span>
        </Link>
        <button type="button" className="navbar__toggle" aria-expanded={menuOpen} aria-controls="main-menu" onClick={() => setMenuOpen((o) => !o)}>
          {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          <span className="visually-hidden">{menuOpen ? 'Close menu' : 'Open menu'}</span>
        </button>
        <div id="main-menu" className={`navbar__collapse ${menuOpen ? 'open' : ''}`}>
          <nav aria-label="Main">
            <ul className="navbar__links">
              {LINKS.map((l) => <li key={l.to}><NavLink to={l.to}>{l.label}</NavLink></li>)}
            </ul>
          </nav>
          <div className="navbar__search"><SearchBar variant="compact" placeholder="Search company or symbol" /></div>
          <div className="navbar__auth">
            {user ? (
              <div className="user-menu" ref={userRef}>
                <button type="button" className="btn btn--on-dark btn--sm" aria-haspopup="true" aria-expanded={userOpen} onClick={() => setUserOpen((o) => !o)}>
                  <UserRound size={16} aria-hidden="true" /> {user.name.split(' ')[0]} <ChevronDown size={14} aria-hidden="true" />
                </button>
                {userOpen && (
                  <div className="user-menu__panel">
                    <Link to="/watchlist">Watchlist</Link>
                    <Link to="/saved-screens">Saved screens</Link>
                    <Link to="/research-notes">Research notes</Link>
                    <Link to="/history">Search history</Link>
                    <Link to="/profile">Profile</Link>
                    <hr style={{ margin: '6px 0' }} />
                    <button type="button" onClick={doLogout}>Log out</button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login" className="btn btn--on-dark btn--sm">Log in</Link>
                <Link to="/register" className="btn btn--primary btn--sm">Create account</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
