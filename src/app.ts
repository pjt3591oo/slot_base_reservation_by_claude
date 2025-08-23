import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import 'reflect-metadata';

import sectionRoutes from './routes/sectionRoutes';
import reservationRoutes from './routes/reservationRoutes';
import { errorHandler } from './middlewares/errorHandler';
import { AppDataSource } from './config/database';
import { redisClient } from './config/redis';

dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Routes
app.use('/api/sections', sectionRoutes);
app.use('/api/reservations', reservationRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    const dbConnected = AppDataSource.isInitialized;
    
    // Check Redis connection
    let redisConnected = false;
    try {
      await redisClient.ping();
      redisConnected = true;
    } catch (error) {
      redisConnected = false;
    }

    res.json({ 
      status: 'OK',
      timestamp: new Date().toISOString(),
      services: {
        database: dbConnected ? 'connected' : 'disconnected',
        redis: redisConnected ? 'connected' : 'disconnected'
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling
app.use(errorHandler);

export default app;