import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import DemoBanner from '../components/DemoBanner.jsx';
import Footer from '../components/Footer.jsx';
import Navbar from '../components/Navbar.jsx';

export default function MainLayout() {
  const { pathname, hash } = useLocation();
  // Scroll to top on navigation (or to the #anchor when present).
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Skip to main content</a>
      <Navbar />
      <DemoBanner />
      <main id="main" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
