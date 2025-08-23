import { AppDataSource } from './config/database';
import { redisClient } from './config/redis';
import app from './app';
import { ReservationScheduler } from './utils/scheduler';
import { SectionService } from './services/sectionService';

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Initialize database connection
    await AppDataSource.initialize();
    console.log('Database connection established');

    // Test Redis connection
    await redisClient.ping();
    console.log('Redis connection established');

    // Sync Redis counters with database
    const sectionService = new SectionService();
    await sectionService.syncRedisWithDatabase();
    console.log('Redis counters synchronized with database');

    // Start the reservation scheduler
    const scheduler = new ReservationScheduler();
    scheduler.start();

    // Start the server
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('\n🚀 Server is ready!');
      console.log(`   Backend: http://localhost:${PORT}`);
    });

    // Graceful shutdown
    const gracefulShutdown = async () => {
      console.log('Shutting down gracefully...');
      
      scheduler.stop();
      
      server.close(() => {
        console.log('HTTP server closed');
      });

      await AppDataSource.destroy();
      console.log('Database connection closed');
      
      redisClient.disconnect();
      console.log('Redis connection closed');
      
      process.exit(0);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();