import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import roundRoutes from './routes/rounds.js';
import shotRoutes from './routes/shots.js';
import courseRoutes from './routes/courses.js';
import benchmarkRoutes from './routes/benchmarks.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Trust Azure reverse proxy
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
    },
  },
}));

// CORS
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173,http://192.168.1.59:5173').split(',');
app.use(cors({
  origin: isProduction ? true : (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('CORS blocked'));
  },
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));

// Rate limiting
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many attempts, try again later' } });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: 'Too many requests' } });

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/rounds', apiLimiter, roundRoutes);
app.use('/api/shots', apiLimiter, shotRoutes);
app.use('/api/courses', apiLimiter, courseRoutes);
app.use('/api/benchmarks', apiLimiter, benchmarkRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Production: serve Vite-built frontend
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
