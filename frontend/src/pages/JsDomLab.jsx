import { useEffect, useRef } from 'react';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { createRatioLab } from '../labs/domDemo.js';

/**
 * React renders only the page frame and an EMPTY container. Everything inside
 * the container is created and updated by plain JavaScript (labs/domDemo.js).
 */
export default function JsDomLab() {
  useDocumentTitle('JavaScript & DOM lab');
  const containerRef = useRef(null);

  useEffect(() => {
    const lab = createRatioLab(containerRef.current);
    return () => lab.destroy(); // remove listeners when the route changes
  }, []);

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Lab' }, { label: 'JavaScript & DOM' }]} />
      <header className="page-header">
        <p className="eyebrow">Course outcome CO2 demonstration</p>
        <h1>JavaScript &amp; DOM lab</h1>
        <p className="lead">This page is deliberately isolated from React: the widgets below are built with vanilla JavaScript and the DOM API (<code>createElement</code>, <code>addEventListener</code>, <code>classList</code>, <code>textContent</code>, <code>dataset</code>, focus management).</p>
      </header>
      <div className="split">
        <div ref={containerRef} className="lab-host" aria-label="Interactive JavaScript demonstration" />
        <aside className="card card--tight small">
          <h2 style={{ fontSize: 'var(--text-lg)' }}>What is demonstrated</h2>
          <ul style={{ paddingLeft: 18 }}>
            <li>Selecting elements (<code>querySelector</code>, <code>closest</code>)</li>
            <li>Click, input, submit and keydown events; event delegation</li>
            <li>Form validation with accessible error messages (<code>aria-invalid</code>, live regions)</li>
            <li>Updating text and visual state (<code>textContent</code>, <code>classList</code>)</li>
            <li>Showing and hiding content (<code>hidden</code>, <code>aria-expanded</code>)</li>
            <li>Keyboard interaction: Enter, Escape, arrow keys, Home/End, roving <code>tabindex</code></li>
            <li>Resetting the interface and cleaning up listeners on unmount</li>
          </ul>
          <p className="mb-0">Source: <code>frontend/src/labs/domDemo.js</code></p>
        </aside>
      </div>
    </div>
  );
}
