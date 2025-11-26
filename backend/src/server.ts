// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { logger } from './utils/logger';
import { initializeDatabase, closeDatabase } from './db/init';
import { startWeeklyReportScheduler } from './jobs/weeklyReport';
import chatRouter from './routes/chat';
import handoffRouter from './routes/handoff';
import eventsRouter from './routes/events';
import analyticsRouter from './routes/analytics';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Trust proxy - Required for Railway/reverse proxy deployments
// This allows Express to read X-Forwarded-* headers correctly
app.set('trust proxy', true);

// Security: Helmet with CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", FRONTEND_URL],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// Security: CORS configuration
// In production, allow same-origin requests (backend serves frontend)
// In development, allow frontend dev server origins
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? true // Allow same-origin in production
    : [FRONTEND_URL, 'http://127.0.0.1:5173', 'http://localhost:5173'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: false,
}));

// Security: JSON body limit (increased for state history)
app.use(express.json({ limit: '1mb' }));

// Security: Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', chatRouter);
app.use('/api', handoffRouter);
app.use('/api', eventsRouter);
app.use('/api', analyticsRouter);

// Serve static files from frontend build (production only)
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, 'public');

  // Serve static assets
  app.use(express.static(publicPath));

  // SPA catch-all: serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
} else {
  // 404 handler for development (when frontend runs separately)
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
}

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('unhandled_error', { error: String(err), path: req.path });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, async () => {
  logger.info('server_started', { port: PORT, env: process.env.NODE_ENV });
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  console.log(`💬 Chat endpoint: http://localhost:${PORT}/api/chat`);
  console.log(`📞 Handoff endpoint: http://localhost:${PORT}/api/handoff/request`);

  // Initialize database (Railway will provide DATABASE_URL)
  if (process.env.DATABASE_URL) {
    try {
      await initializeDatabase();
      console.log(`✅ Database initialized`);
    } catch (error) {
      console.error(`❌ Database initialization failed:`, error);
      // Server continues even if DB fails (for debugging)
    }
  } else {
    console.log(`⚠️  DATABASE_URL not set - using file storage fallback`);
  }

  // Start weekly report scheduler
  try {
    startWeeklyReportScheduler();
    console.log(`📧 Weekly report scheduler started`);
  } catch (error) {
    console.error(`❌ Weekly report scheduler failed to start:`, error);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('server_shutdown', { signal: 'SIGTERM' });
  await closeDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('server_shutdown', { signal: 'SIGINT' });
  await closeDatabase();
  process.exit(0);
});
