import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import RequireAuth from './components/RequireAuth.jsx';
import { LoadingState } from './components/States.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import StockLayout from './layouts/StockLayout.jsx';
import Home from './pages/Home.jsx';
import NotFound from './pages/NotFound.jsx';

// Route-level code splitting: each page is downloaded only when visited.
const MarketOverview = lazy(() => import('./pages/MarketOverview.jsx'));
const CompanySearch = lazy(() => import('./pages/CompanySearch.jsx'));
const StockOverview = lazy(() => import('./pages/StockOverview.jsx'));
const FundamentalSummary = lazy(() => import('./pages/FundamentalSummary.jsx'));
const Valuation = lazy(() => import('./pages/Valuation.jsx'));
const Profitability = lazy(() => import('./pages/Profitability.jsx'));
const Growth = lazy(() => import('./pages/Growth.jsx'));
const FinancialHealth = lazy(() => import('./pages/FinancialHealth.jsx'));
const IncomeStatement = lazy(() => import('./pages/IncomeStatement.jsx'));
const BalanceSheet = lazy(() => import('./pages/BalanceSheet.jsx'));
const CashFlow = lazy(() => import('./pages/CashFlow.jsx'));
const Performance = lazy(() => import('./pages/Performance.jsx'));
const Compare = lazy(() => import('./pages/Compare.jsx'));
const Screener = lazy(() => import('./pages/Screener.jsx'));
const Sectors = lazy(() => import('./pages/Sectors.jsx'));
const SectorAnalysis = lazy(() => import('./pages/SectorAnalysis.jsx'));
const Watchlist = lazy(() => import('./pages/Watchlist.jsx'));
const SavedScreens = lazy(() => import('./pages/SavedScreens.jsx'));
const SearchHistory = lazy(() => import('./pages/SearchHistory.jsx'));
const ResearchNotes = lazy(() => import('./pages/ResearchNotes.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Methodology = lazy(() => import('./pages/Methodology.jsx'));
const Glossary = lazy(() => import('./pages/Glossary.jsx'));
const JsDomLab = lazy(() => import('./pages/JsDomLab.jsx'));

const page = (el) => <Suspense fallback={<div className="container page"><LoadingState /></div>}>{el}</Suspense>;
const priv = (el) => <RequireAuth>{page(el)}</RequireAuth>;
const sub = (el) => <Suspense fallback={<LoadingState />}>{el}</Suspense>;

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<Home />} />
        <Route path="market" element={page(<MarketOverview />)} />
        <Route path="search" element={page(<CompanySearch />)} />
        <Route path="stocks/:symbol" element={<StockLayout />}>
          <Route index element={sub(<StockOverview />)} />
          <Route path="fundamentals" element={sub(<FundamentalSummary />)} />
          <Route path="valuation" element={sub(<Valuation />)} />
          <Route path="profitability" element={sub(<Profitability />)} />
          <Route path="growth" element={sub(<Growth />)} />
          <Route path="financial-health" element={sub(<FinancialHealth />)} />
          <Route path="income-statement" element={sub(<IncomeStatement />)} />
          <Route path="balance-sheet" element={sub(<BalanceSheet />)} />
          <Route path="cash-flow" element={sub(<CashFlow />)} />
          <Route path="performance" element={sub(<Performance />)} />
          <Route path="*" element={<NotFound message="That analysis section does not exist." />} />
        </Route>
        <Route path="compare" element={page(<Compare />)} />
        <Route path="screener" element={page(<Screener />)} />
        <Route path="sectors" element={page(<Sectors />)} />
        <Route path="sectors/:sectorSlug" element={page(<SectorAnalysis />)} />
        <Route path="watchlist" element={priv(<Watchlist />)} />
        <Route path="saved-screens" element={priv(<SavedScreens />)} />
        <Route path="history" element={priv(<SearchHistory />)} />
        <Route path="research-notes" element={priv(<ResearchNotes />)} />
        <Route path="login" element={page(<Login />)} />
        <Route path="register" element={page(<Register />)} />
        <Route path="profile" element={priv(<Profile />)} />
        <Route path="methodology" element={page(<Methodology />)} />
        <Route path="glossary" element={page(<Glossary />)} />
        <Route path="lab/javascript-dom" element={page(<JsDomLab />)} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
