/**
 * CO2 demonstration: plain JavaScript + DOM APIs, no React.
 *
 * createRatioLab(container) builds an interactive widget INSIDE `container`
 * using document.createElement, addEventListener, classList, textContent,
 * dataset and focus management. React only provides the empty container and
 * calls destroy() on unmount, so the two never fight over the same nodes.
 */
export function createRatioLab(container) {
  const listeners = [];
  // Track every listener so destroy() can remove them all (no leaks).
  const on = (el, type, fn) => { el.addEventListener(type, fn); listeners.push([el, type, fn]); };
  const el = (tag, attrs = {}, text) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k.startsWith('data-')) node.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
      else node.setAttribute(k, v);
    }
    if (text !== undefined) node.textContent = text; // textContent, never innerHTML: user input cannot inject markup
    return node;
  };

  container.replaceChildren();
  const root = el('div', { class: 'lab' });

  // ---- 1. P/E calculator: input events, validation, Enter / Escape keys ------
  const calc = el('section', { class: 'lab__panel', 'aria-labelledby': 'lab-calc-title' });
  calc.append(el('h3', { id: 'lab-calc-title' }, '1. P/E ratio calculator'));
  const form = el('form', { novalidate: '' });
  const priceField = el('div', { class: 'field' });
  priceField.append(el('label', { for: 'lab-price' }, 'Share price (₹)'), el('input', { id: 'lab-price', class: 'input', inputmode: 'decimal', 'aria-describedby': 'lab-price-err' }), el('span', { id: 'lab-price-err', class: 'field-error', 'aria-live': 'polite' }));
  const epsField = el('div', { class: 'field' });
  epsField.append(el('label', { for: 'lab-eps' }, 'Earnings per share (₹)'), el('input', { id: 'lab-eps', class: 'input', inputmode: 'decimal', 'aria-describedby': 'lab-eps-err' }), el('span', { id: 'lab-eps-err', class: 'field-error', 'aria-live': 'polite' }));
  const buttons = el('div', { class: 'btn-row' });
  const calcBtn = el('button', { type: 'submit', class: 'btn btn--primary' }, 'Calculate P/E');
  const resetBtn = el('button', { type: 'button', class: 'btn btn--secondary' }, 'Reset');
  buttons.append(calcBtn, resetBtn);
  const result = el('p', { class: 'lab__result', role: 'status', 'aria-live': 'polite' }, 'Enter a price and EPS, then press Calculate (or Enter). Press Escape to reset.');
  form.append(priceField, epsField, buttons, result);
  calc.append(form);

  const priceInput = form.querySelector('#lab-price');
  const epsInput = form.querySelector('#lab-eps');

  function validateNumber(input, errorEl, label, { positive = false } = {}) {
    const raw = input.value.trim();
    let message = '';
    if (raw === '') message = `${label} is required.`;
    else if (!/^-?\d+(\.\d+)?$/.test(raw)) message = `${label} must be a number.`;
    else if (positive && Number(raw) <= 0) message = `${label} must be greater than zero.`;
    errorEl.textContent = message;
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    input.classList.toggle('lab__input--ok', !message && raw !== '');
    return message ? null : Number(raw);
  }

  function calculate() {
    const price = validateNumber(priceInput, form.querySelector('#lab-price-err'), 'Share price', { positive: true });
    const eps = validateNumber(epsInput, form.querySelector('#lab-eps-err'), 'EPS');
    result.className = 'lab__result';
    if (price === null || eps === null) {
      result.textContent = 'Please fix the highlighted fields.';
      result.classList.add('lab__result--error');
      log('validation failed');
      return;
    }
    if (eps <= 0) {
      result.textContent = 'EPS is zero or negative, so the P/E ratio is not meaningful (the company made a loss).';
      result.classList.add('lab__result--warn');
      log('P/E not meaningful (EPS ≤ 0)');
      return;
    }
    const pe = price / eps;
    result.textContent = `P/E = ${price} ÷ ${eps} = ${pe.toFixed(2)}×. Investors are paying ₹${pe.toFixed(2)} for each ₹1 of annual earnings.`;
    result.classList.add('lab__result--ok');
    log(`calculated P/E ${pe.toFixed(2)}`);
  }

  function reset() {
    form.reset();
    for (const input of [priceInput, epsInput]) { input.removeAttribute('aria-invalid'); input.classList.remove('lab__input--ok'); }
    form.querySelectorAll('.field-error').forEach((n) => { n.textContent = ''; });
    result.className = 'lab__result';
    result.textContent = 'Inputs cleared.';
    priceInput.focus();
    log('reset');
  }

  on(form, 'submit', (e) => { e.preventDefault(); calculate(); });
  on(resetBtn, 'click', reset);
  on(form, 'keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); reset(); } });
  // Live feedback while typing ("input" event).
  for (const input of [priceInput, epsInput]) {
    on(input, 'input', () => {
      const ok = /^-?\d+(\.\d+)?$/.test(input.value.trim());
      input.classList.toggle('lab__input--ok', ok);
    });
  }

  // ---- 2. Show / hide content ------------------------------------------------
  const toggle = el('section', { class: 'lab__panel', 'aria-labelledby': 'lab-toggle-title' });
  toggle.append(el('h3', { id: 'lab-toggle-title' }, '2. Show and hide the formula'));
  const toggleBtn = el('button', { type: 'button', class: 'btn btn--secondary', 'aria-expanded': 'false', 'aria-controls': 'lab-formula' }, 'Show formula');
  const formula = el('div', { id: 'lab-formula', class: 'lab__formula', hidden: '' });
  formula.append(el('p', {}, 'P/E ratio = Share price ÷ Earnings per share'), el('p', { class: 'small muted' }, 'A higher P/E means investors pay more for each rupee of current profit - often because they expect growth.'));
  toggle.append(toggleBtn, formula);
  on(toggleBtn, 'click', () => {
    const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    toggleBtn.setAttribute('aria-expanded', String(!expanded));
    toggleBtn.textContent = expanded ? 'Show formula' : 'Hide formula';
    formula.hidden = expanded;
    log(expanded ? 'formula hidden' : 'formula shown');
  });

  // ---- 3. Keyboard-navigable checklist (roving tabindex) -----------------------
  const list = el('section', { class: 'lab__panel', 'aria-labelledby': 'lab-list-title' });
  list.append(el('h3', { id: 'lab-list-title' }, '3. Pick the metrics you would check'), el('p', { class: 'small muted' }, 'Use ↑/↓ (or ←/→) to move, Space or Enter to select, Home/End to jump.'));
  const metrics = ['P/E ratio', 'Return on equity', 'Debt-to-equity', 'Revenue growth', 'Free cash flow', 'Dividend yield'];
  const ul = el('ul', { class: 'lab__options', role: 'listbox', 'aria-multiselectable': 'true', 'aria-labelledby': 'lab-list-title' });
  metrics.forEach((m, i) => ul.append(el('li', { role: 'option', 'aria-selected': 'false', tabindex: i === 0 ? '0' : '-1', 'data-metric': m }, m)));
  const count = el('p', { class: 'small', 'aria-live': 'polite' }, '0 metrics selected.');
  list.append(ul, count);
  const options = () => [...ul.querySelectorAll('[role="option"]')];
  const focusOption = (idx) => {
    const opts = options();
    const target = opts[(idx + opts.length) % opts.length];
    opts.forEach((o) => o.setAttribute('tabindex', '-1'));
    target.setAttribute('tabindex', '0');
    target.focus();
  };
  const toggleOption = (opt) => {
    const selected = opt.getAttribute('aria-selected') === 'true';
    opt.setAttribute('aria-selected', String(!selected));
    opt.classList.toggle('is-selected', !selected);
    const chosen = options().filter((o) => o.getAttribute('aria-selected') === 'true').map((o) => o.dataset.metric);
    count.textContent = chosen.length ? `${chosen.length} selected: ${chosen.join(', ')}.` : '0 metrics selected.';
    log(`${selected ? 'deselected' : 'selected'} ${opt.dataset.metric}`);
  };
  on(ul, 'click', (e) => {
    const opt = e.target.closest('[role="option"]'); // event delegation: one listener for all items
    if (opt) { focusOption(options().indexOf(opt)); toggleOption(opt); }
  });
  on(ul, 'keydown', (e) => {
    const opts = options();
    const idx = opts.indexOf(document.activeElement);
    if (idx < 0) return;
    if (['ArrowDown', 'ArrowRight'].includes(e.key)) { e.preventDefault(); focusOption(idx + 1); }
    else if (['ArrowUp', 'ArrowLeft'].includes(e.key)) { e.preventDefault(); focusOption(idx - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusOption(0); }
    else if (e.key === 'End') { e.preventDefault(); focusOption(opts.length - 1); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleOption(opts[idx]); }
  });

  // ---- Event log -------------------------------------------------------------
  const logPanel = el('section', { class: 'lab__panel lab__panel--log', 'aria-labelledby': 'lab-log-title' });
  logPanel.append(el('h3', { id: 'lab-log-title' }, 'Event log'));
  const logList = el('ol', { class: 'lab__log', 'aria-live': 'off' });
  const clearLog = el('button', { type: 'button', class: 'btn btn--ghost btn--sm' }, 'Clear log');
  logPanel.append(logList, clearLog);
  on(clearLog, 'click', () => logList.replaceChildren());
  function log(message) {
    const time = new Date().toLocaleTimeString('en-IN', { hour12: false });
    logList.prepend(el('li', {}, `${time} - ${message}`));
    while (logList.children.length > 12) logList.lastElementChild.remove();
  }

  root.append(calc, toggle, list, logPanel);
  container.append(root);
  log('lab initialised');

  return {
    destroy() {
      for (const [node, type, fn] of listeners) node.removeEventListener(type, fn);
      container.replaceChildren();
    },
  };
}
