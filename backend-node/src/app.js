/**
 * Express application factory (no network listening here, so tests can use it).
 */
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { loadUser } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter, requireSafeOrigin } from './middleware/security.js';
import analysisRoutes from './routes/analysis.js';
import authRoutes from './routes/auth.js';
import companyRoutes from './routes/companies.js';
import compareRoutes from './routes/compare.js';
import historyRoutes from './routes/history.js';
import marketRoutes from './routes/market.js';
import metaRoutes from './routes/meta.js';
import researchNoteRoutes from './routes/researchNotes.js';
import savedScreenRoutes from './routes/savedScreens.js';
import screenerRoutes from './routes/screener.js';
import sectorRoutes from './routes/sectors.js';
import userRoutes from './routes/users.js';
import watchlistRoutes from './routes/watchlist.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback'); // correct client IPs behind the Vite dev proxy / a local reverse proxy

  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
  app.use(cors({ origin: config.corsOrigins, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  app.use('/api', apiLimiter, requireSafeOrigin, loadUser);
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  app.use('/api', metaRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/companies', companyRoutes);
  app.use('/api/analysis', analysisRoutes);
  app.use('/api/screener', screenerRoutes);
  app.use('/api/compare', compareRoutes);
  app.use('/api/sectors', sectorRoutes);
  app.use('/api/market', marketRoutes);
  app.use('/api/watchlist', watchlistRoutes);
  app.use('/api/history', historyRoutes);
  app.use('/api/saved-screens', savedScreenRoutes);
  app.use('/api/research-notes', researchNoteRoutes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
