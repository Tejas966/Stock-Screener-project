import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MetricCard from '../components/MetricCard.jsx';
import RequireAuth from '../components/RequireAuth.jsx';
import SearchBar from '../components/SearchBar.jsx';
import StockTable from '../components/StockTable.jsx';
import { ErrorState, LoadingState } from '../components/States.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { createRatioLab } from '../labs/domDemo.js';

/** Minimal fetch mock: route table of path -> { status, body }. */
function mockFetch(routes) {
  return vi.fn(async (url) => {
    const path = String(url).replace(/^\/api/, '');
    const key = Object.keys(routes).find((k) => path.startsWith(k));
    const r = key ? routes[key] : { status: 404, body: { error: { code: 'NOT_FOUND', message: 'nf' } } };
    return { ok: r.status < 400, status: r.status, json: async () => r.body };
  });
}

const wrap = (ui, { path = '/', routes } = {}) => render(
  <MemoryRouter initialEntries={[path]}>
    <AuthProvider>{routes ?? ui}</AuthProvider>
  </MemoryRouter>,
);

beforeEach(() => { vi.stubGlobal('fetch', mockFetch({ '/auth/me': { status: 200, body: { data: null } } })); });
afterEach(() => vi.unstubAllGlobals());

describe('MetricCard', () => {
  it('shows a calculated value with period and glossary link', () => {
    wrap(<MetricCard metric={{ key: 'pe_ratio', label: 'P/E ratio', value: 26.12, unit: 'multiple', status: 'calculated', period_end: '2025-03-31', flags: [] }} />);
    expect(screen.getByText('26.1×')).toBeInTheDocument();
    expect(screen.getByText(/Calculated · FY ending 31 Mar 2025/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /What is P\/E ratio/ })).toHaveAttribute('href', '/glossary#pe-ratio');
  });
  it('shows "Not meaningful" with its reason instead of a number and without colour', () => {
    const { container } = wrap(<MetricCard signed metric={{ key: 'pe_ratio', label: 'P/E ratio', value: null, unit: 'multiple', status: 'not_meaningful', reason: 'EPS is zero or negative', flags: [] }} />);
    expect(screen.getByText('Not meaningful')).toBeInTheDocument();
    expect(screen.getByText('EPS is zero or negative')).toBeInTheDocument();
    expect(container.querySelector('.change--pos, .change--neg')).toBeNull();
    expect(screen.queryByText('Calculated')).toBeNull();
  });
});

describe('StockTable', () => {
  const rows = [
    { company: { name: 'Alpha Ltd', symbol: 'ALPHA.NS', ticker: 'ALPHA', exchange: 'NSE', sector: { name: 'IT' } }, price: 100, change_pct: 1.5, metrics: { pe_ratio: 20, roe: null }, statuses: { roe: { status: 'not_meaningful', reason: 'bank' } } },
  ];
  it('renders values, n.m. markers and sort callbacks', async () => {
    const onSort = vi.fn();
    wrap(<StockTable rows={rows} columns={[{ key: 'pe_ratio', label: 'P/E' }, { key: 'roe', label: 'ROE' }]} caption="t" sort={{ field: 'pe_ratio', direction: 'desc' }} onSort={onSort} />);
    expect(screen.getByText('20.0×')).toBeInTheDocument();
    expect(screen.getByTitle('bank')).toHaveTextContent('n.m.');
    await userEvent.click(screen.getByRole('button', { name: /P\/E/ }));
    expect(onSort).toHaveBeenCalledWith({ field: 'pe_ratio', direction: 'asc' });
  });
});

describe('states', () => {
  it('loading state is announced politely and errors as alerts', () => {
    wrap(<><LoadingState label="Loading data" /><ErrorState error={new Error('Server down')} /></>);
    expect(screen.getByRole('status')).toHaveTextContent('Loading data');
    expect(screen.getByRole('alert')).toHaveTextContent('Server down');
  });
});

describe('SearchBar', () => {
  it('fetches suggestions and calls onSelect with keyboard', async () => {
    vi.stubGlobal('fetch', mockFetch({
      '/auth/me': { status: 200, body: { data: null } },
      '/companies/search': { status: 200, body: { data: { results: [{ name: 'Infosys Ltd', symbol: 'INFY.NS', ticker: 'INFY', exchange: 'NSE', sector: { name: 'IT' } }] } } },
    }));
    const onSelect = vi.fn();
    wrap(<SearchBar onSelect={onSelect} />);
    const box = screen.getByRole('combobox');
    await userEvent.type(box, 'inf');
    await screen.findByRole('option', { name: /Infosys Ltd/ });
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'INFY.NS' }));
  });
});

describe('protected routes', () => {
  it('redirects anonymous users to login', async () => {
    wrap(null, {
      path: '/watchlist',
      routes: (
        <Routes>
          <Route path="/watchlist" element={<RequireAuth><p>secret watchlist</p></RequireAuth>} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      ),
    });
    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('secret watchlist')).toBeNull();
  });
  it('lets authenticated users through', async () => {
    vi.stubGlobal('fetch', mockFetch({ '/auth/me': { status: 200, body: { data: { id: 1, name: 'A', email: 'a@b.co' } } } }));
    wrap(null, { path: '/watchlist', routes: <Routes><Route path="/watchlist" element={<RequireAuth><p>secret watchlist</p></RequireAuth>} /></Routes> });
    expect(await screen.findByText('secret watchlist')).toBeInTheDocument();
  });
});

describe('vanilla JS DOM lab', () => {
  it('validates, calculates, toggles and cleans up', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const lab = createRatioLab(host);
    host.querySelector('button[type="submit"]').click();
    expect(host.querySelector('#lab-price-err').textContent).toMatch(/required/);
    host.querySelector('#lab-price').value = '500';
    host.querySelector('#lab-eps').value = '-2';
    host.querySelector('form').requestSubmit();
    expect(host.querySelector('.lab__result').textContent).toMatch(/not meaningful/);
    host.querySelector('#lab-eps').value = '25';
    host.querySelector('form').requestSubmit();
    expect(host.querySelector('.lab__result').textContent).toMatch(/20\.00×/);
    const toggle = host.querySelector('[aria-controls="lab-formula"]');
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('#lab-formula').hidden).toBe(false);
    lab.destroy();
    expect(host.childElementCount).toBe(0);
  });
});

describe('login form', () => {
  it('shows server error for wrong credentials', async () => {
    vi.stubGlobal('fetch', mockFetch({
      '/auth/me': { status: 200, body: { data: null } },
      '/auth/login': { status: 401, body: { error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' } } },
    }));
    const { default: Login } = await import('../pages/Login.jsx');
    wrap(<Login />);
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Email/), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/Password/), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Email or password is incorrect.'));
  });
});
