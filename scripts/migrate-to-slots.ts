import { AppDataSource } from '../src/config/database';
import { Section } from '../src/entities/Section';
import { SlotManager } from '../src/utils/slotManager';
import { SeatCounter } from '../src/utils/seatCounter';
import { redisClient } from '../src/config/redis';

async function migrateToSlots() {
  try {
    // Initialize database connection
    await AppDataSource.initialize();
    console.log('Database connected');

    console.log('Starting migration to slot-based system...');

    const sectionRepository = AppDataSource.getRepository(Section);
    const sections = await sectionRepository.find();

    console.log(`Found ${sections.length} sections to migrate`);

    for (const section of sections) {
      console.log(`\nMigrating section: ${section.name} (ID: ${section.id})`);
      
      // Get current available seats from old system
      const currentAvailable = await SeatCounter.getAvailableSeats(section.id);
      const occupiedSeats = section.currentOccupancy;
      
      console.log(`  Total capacity: ${section.totalCapacity}`);
      console.log(`  Current occupancy: ${occupiedSeats}`);
      console.log(`  Available seats (Redis): ${currentAvailable}`);

      // Use 1:1 mapping: 1 slot = 1 seat
      const slotsCount = section.totalCapacity;

      console.log(`  Creating ${slotsCount} slots (1:1 mapping with seats)`);

      // Initialize slots
      await SlotManager.initializeSlots(section.id, section.totalCapacity);

      // If there are occupied seats, we need to mark some slots as confirmed
      if (occupiedSeats > 0) {
        const metadata = await SlotManager.getSlotMetadata(section.id);
        if (metadata) {
          // With 1:1 mapping, slots to reserve = occupied seats
          const slotsToReserve = occupiedSeats;
          console.log(`  Marking ${slotsToReserve} slots as confirmed for existing reservations`);

          // Create a dummy reservation ID for migration
          const migrationReservationId = `migration-${section.id}`;
          
          // Reserve and immediately confirm slots
          const reservedSlots = await SlotManager.reserveSlots(
            section.id, 
            occupiedSeats, 
            migrationReservationId
          );
          
          await SlotManager.confirmSlots(section.id, reservedSlots, migrationReservationId);
          console.log(`  Successfully migrated ${reservedSlots.length} slots to confirmed state`);
        }
      }

      // Verify migration
      const slotStats = await SlotManager.getSlotStats(section.id);
      const availableSeats = await SlotManager.getAvailableSeatsCount(section.id);
      
      console.log(`  Migration complete for ${section.name}:`);
      console.log(`    - Available slots: ${slotStats.available}`);
      console.log(`    - Reserved slots: ${slotStats.reserved}`);
      console.log(`    - Confirmed slots: ${slotStats.confirmed}`);
      console.log(`    - Available seats: ${availableSeats}`);
    }

    console.log('\n✅ Migration completed successfully!');

    // Create backup of old seat counter data
    console.log('\nCreating backup of old seat counter data...');
    for (const section of sections) {
      const oldKey = `section:seats:${section.id}`;
      const backupKey = `backup:${oldKey}`;
      const value = await redisClient.get(oldKey);
      if (value) {
        await redisClient.set(backupKey, value);
        console.log(`  Backed up: ${oldKey} → ${backupKey}`);
      }
    }

    console.log('\n📋 Migration Summary:');
    console.log('- All sections have been migrated to slot-based system');
    console.log('- Old seat counter data has been backed up with "backup:" prefix');
    console.log('- You can now update the ReservationService to use SlotManager');
    console.log('\n⚠️  Note: Remember to update your application code to use the new SlotManager!');

  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await redisClient.quit();
    await AppDataSource.destroy();
  }
}

// Run the migration
migrateToSlots();