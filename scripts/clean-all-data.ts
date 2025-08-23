import { AppDataSource } from '../src/config/database';
import { Section } from '../src/entities/Section';
import { Reservation } from '../src/entities/Reservation';
import { ReservationLog } from '../src/entities/ReservationLog';
import { User } from '../src/entities/User';
import { redisClient } from '../src/config/redis';

async function cleanAllData() {
  try {
    // Initialize database connection
    await AppDataSource.initialize();
    console.log('Database connected');

    console.log('\n🧹 Starting complete data cleanup...\n');

    // Get repositories
    const sectionRepository = AppDataSource.getRepository(Section);
    const reservationRepository = AppDataSource.getRepository(Reservation);
    const reservationLogRepository = AppDataSource.getRepository(ReservationLog);
    const userRepository = AppDataSource.getRepository(User);

    // Delete all reservation logs first (due to foreign key constraints)
    const reservationLogs = await reservationLogRepository.find();
    if (reservationLogs.length > 0) {
      await reservationLogRepository.remove(reservationLogs);
      console.log(`✅ Deleted ${reservationLogs.length} reservation logs`);
    } else {
      console.log('ℹ️  No reservation logs to delete');
    }

    // Delete all reservations
    const reservations = await reservationRepository.find();
    if (reservations.length > 0) {
      await reservationRepository.remove(reservations);
      console.log(`✅ Deleted ${reservations.length} reservations`);
    } else {
      console.log('ℹ️  No reservations to delete');
    }

    // Delete all sections
    const sections = await sectionRepository.find();
    if (sections.length > 0) {
      await sectionRepository.remove(sections);
      console.log(`✅ Deleted ${sections.length} sections`);
    } else {
      console.log('ℹ️  No sections to delete');
    }

    // Delete all users
    const users = await userRepository.find();
    if (users.length > 0) {
      await userRepository.remove(users);
      console.log(`✅ Deleted ${users.length} users`);
    } else {
      console.log('ℹ️  No users to delete');
    }

    console.log('\n🔧 Cleaning Redis data...\n');

    // Get all Redis keys
    const keys = await redisClient.keys('*');
    console.log(`Found ${keys.length} Redis keys`);

    if (keys.length > 0) {
      // Group keys by type for better reporting
      const keyGroups: { [key: string]: string[] } = {
        'section:seats:': [],
        'section:slot:': [],
        'lock:': [],
        'cache:': [],
        'backup:': [],
        'other': []
      };

      // Categorize keys
      for (const key of keys) {
        let categorized = false;
        for (const prefix of Object.keys(keyGroups)) {
          if (prefix !== 'other' && key.startsWith(prefix)) {
            keyGroups[prefix].push(key);
            categorized = true;
            break;
          }
        }
        if (!categorized) {
          keyGroups.other.push(key);
        }
      }

      // Delete all keys using pipeline for better performance
      const pipeline = redisClient.pipeline();
      for (const key of keys) {
        pipeline.del(key);
      }
      await pipeline.exec();

      // Report what was deleted
      for (const [prefix, groupKeys] of Object.entries(keyGroups)) {
        if (groupKeys.length > 0) {
          console.log(`✅ Deleted ${groupKeys.length} ${prefix === 'other' ? 'miscellaneous' : prefix} keys`);
        }
      }
    } else {
      console.log('ℹ️  No Redis keys to delete');
    }

    console.log('\n✨ All data has been cleaned successfully!');
    console.log('\n📝 Summary:');
    console.log('- All database tables have been cleared');
    console.log('- All Redis data has been removed');
    console.log('- System is ready for fresh data');
    console.log('\n💡 Tip: Run "npm run seed:all" to populate with fresh sample data');

  } catch (error) {
    console.error('❌ Error cleaning data:', error);
    process.exit(1);
  } finally {
    await redisClient.quit();
    await AppDataSource.destroy();
  }
}

// Run the cleanup function
cleanAllData();