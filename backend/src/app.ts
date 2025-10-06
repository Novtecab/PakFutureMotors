import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';

// Load environment variables
config();

const app = express();
const PORT = process.env.API_PORT || 3000;

// Security and CORS middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'pakfuturemotors-backend',
    version: '1.0.0'
  });
});

// API routes placeholder
app.use('/api', (req, res) => {
  res.json({
    message: 'PakFutureMotors API',
    version: '1.0.0',
    endpoints: [
      'GET /health - Health check',
      'POST /api/auth/* - Authentication endpoints',
      'GET /api/products - Product catalog',
      'GET /api/services - Service listings',
      'POST /api/cart - Cart management',
      'POST /api/orders - Order processing',
      'POST /api/bookings - Service bookings'
    ]
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: {
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      message: 'Endpoint not found',
      path: req.originalUrl
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 PakFutureMotors Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;