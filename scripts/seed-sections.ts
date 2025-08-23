import { AppDataSource } from '../src/config/database';
import { Section, SectionStatus } from '../src/entities/Section';
import { SeatCounter } from '../src/utils/seatCounter';
import { SlotManager } from '../src/utils/slotManager';
import { features } from '../src/config/features';
import { redisClient } from '../src/config/redis';

async function seedSections() {
  try {
    // Initialize database connection
    await AppDataSource.initialize();
    console.log('Database connected');

    // Redis is already connected via ioredis
    console.log('Using Redis connection');

    const sectionRepository = AppDataSource.getRepository(Section);

    // Clear existing sections
    const existingSections = await sectionRepository.find();
    if (existingSections.length > 0) {
      await sectionRepository.remove(existingSections);
      console.log(`Cleared ${existingSections.length} existing sections`);
    }

    // Create sections data
    const sectionsData = [
      {
        name: '1층 스탠딩 A구역',
        description: '무대 앞 중앙 스탠딩 구역 - 가장 가까운 거리에서 공연을 즐기실 수 있습니다',
        totalCapacity: 300,
        currentOccupancy: 0,
        status: SectionStatus.OPEN,
        price: 180000,
        location: '1층 중앙 앞'
      },
      {
        name: '1층 스탠딩 B구역',
        description: '무대 앞 좌측 스탠딩 구역 - 역동적인 공연을 가까이서 감상하실 수 있습니다',
        totalCapacity: 200,
        currentOccupancy: 0,
        status: SectionStatus.OPEN,
        price: 150000,
        location: '1층 좌측'
      },
      {
        name: '1층 스탠딩 C구역',
        description: '무대 앞 우측 스탠딩 구역 - 활기찬 분위기를 만끽하실 수 있습니다',
        totalCapacity: 200,
        currentOccupancy: 0,
        status: SectionStatus.OPEN,
        price: 150000,
        location: '1층 우측'
      },
      {
        name: '2층 자유석 A구역',
        description: '2층 좌측 자유석 - 편안하게 앉아서 공연을 관람하실 수 있습니다',
        totalCapacity: 400,
        currentOccupancy: 0,
        status: SectionStatus.OPEN,
        price: 120000,
        location: '2층 좌측'
      },
      {
        name: '2층 자유석 B구역',
        description: '2층 중앙 자유석 - 무대 전체를 한눈에 볼 수 있는 최적의 시야',
        totalCapacity: 500,
        currentOccupancy: 0,
        status: SectionStatus.OPEN,
        price: 130000,
        location: '2층 중앙'
      },
      {
        name: '2층 자유석 C구역',
        description: '2층 우측 자유석 - 여유롭게 공연을 즐기실 수 있습니다',
        totalCapacity: 400,
        currentOccupancy: 0,
        status: SectionStatus.OPEN,
        price: 120000,
        location: '2층 우측'
      },
      {
        name: '3층 자유석 A구역',
        description: '3층 좌측 자유석 - 전체적인 무대 연출을 감상하기 좋은 구역',
        totalCapacity: 300,
        currentOccupancy: 0,
        status: SectionStatus.OPEN,
        price: 80000,
        location: '3층 좌측'
      },
      {
        name: '3층 자유석 B구역',
        description: '3층 중앙 자유석 - 음향이 가장 균형잡힌 구역',
        totalCapacity: 400,
        currentOccupancy: 0,
        status: SectionStatus.OPEN,
        price: 90000,
        location: '3층 중앙'
      },
      {
        name: '3층 자유석 C구역',
        description: '3층 우측 자유석 - 합리적인 가격으로 공연을 즐기실 수 있습니다',
        totalCapacity: 300,
        currentOccupancy: 0,
        status: SectionStatus.OPEN,
        price: 80000,
        location: '3층 우측'
      },
      {
        name: 'VIP 박스석',
        description: '프리미엄 박스석 - 프라이빗한 공간에서 최상의 서비스와 함께 공연 관람',
        totalCapacity: 50,
        currentOccupancy: 0,
        status: SectionStatus.OPEN,
        price: 350000,
        location: '2층 VIP 라운지'
      },
      {
        name: '휠체어 구역',
        description: '휠체어 이용자를 위한 전용 구역 - 편안한 접근성과 시야 보장',
        totalCapacity: 20,
        currentOccupancy: 0,
        status: SectionStatus.OPEN,
        price: 100000,
        location: '1층 후면'
      },
      {
        name: '4층 전망석',
        description: '4층 최상단 구역 - 파노라마 뷰로 공연 전체를 조망',
        totalCapacity: 200,
        currentOccupancy: 0,
        status: SectionStatus.MAINTENANCE,
        price: 60000,
        location: '4층 중앙'
      }
    ];

    // Save sections to database
    const sections = await sectionRepository.save(sectionsData);
    console.log(`Created ${sections.length} sections`);

    // Initialize Redis data for each section
    for (const section of sections) {
      if (features.useSlotBasedReservation) {
        // Initialize slots for slot-based system (1:1 mapping)
        await SlotManager.initializeSlots(section.id, section.totalCapacity);
        console.log(`Initialized slots for section: ${section.name} (ID: ${section.id}) - ${section.totalCapacity} slots`);
      } else {
        // Initialize counters for traditional system
        await SeatCounter.initializeSection(section.id, section.totalCapacity);
        console.log(`Initialized Redis counter for section: ${section.name} (ID: ${section.id})`);
      }
    }

    // Add some sample occupancy to make it more realistic
    const sampleOccupancy = [
      { index: 0, occupied: 120 }, // 1층 스탠딩 A구역 - 40% occupied
      { index: 1, occupied: 50 },  // 1층 스탠딩 B구역 - 25% occupied
      { index: 3, occupied: 280 }, // 2층 자유석 A구역 - 70% occupied
      { index: 4, occupied: 350 }, // 2층 자유석 B구역 - 70% occupied
      { index: 7, occupied: 200 }, // 3층 자유석 B구역 - 50% occupied
      { index: 9, occupied: 45 },  // VIP 박스석 - 90% occupied
    ];

    for (const { index, occupied } of sampleOccupancy) {
      if (sections[index]) {
        const section = sections[index];
        
        if (features.useSlotBasedReservation) {
          // For slot-based system, reserve and confirm slots
          if (occupied > 0) {
            const migrationReservationId = `seed-${section.id}`;
            try {
              // Reserve slots equal to occupied seats
              const reservedSlots = await SlotManager.reserveSlots(
                section.id,
                occupied,
                migrationReservationId
              );
              // Immediately confirm them
              await SlotManager.confirmSlots(section.id, reservedSlots, migrationReservationId);
              console.log(`Reserved and confirmed ${reservedSlots.length} slots for ${section.name}`);
            } catch (error) {
              console.error(`Failed to reserve slots for ${section.name}:`, error);
            }
          }
        } else {
          // For traditional system, update Redis counter
          const currentAvailable = section.totalCapacity - occupied;
          await SeatCounter.syncWithDatabase(section.id, currentAvailable);
        }
        
        // Update database
        section.currentOccupancy = occupied;
        await sectionRepository.save(section);
        console.log(`Set occupancy for ${section.name}: ${occupied}/${section.totalCapacity}`);
      }
    }

    console.log('\nSeed data created successfully!');
    console.log(`\nSystem Mode: ${features.useSlotBasedReservation ? 'Slot-based (1:1 mapping)' : 'Traditional lock-based'}`);
    console.log('\nSection Summary:');
    
    const allSections = await sectionRepository.find({ order: { price: 'DESC' } });
    for (const section of allSections) {
      const availableSeats = section.totalCapacity - section.currentOccupancy;
      const occupancyRate = ((section.currentOccupancy / section.totalCapacity) * 100).toFixed(1);
      console.log(`- ${section.name}: ${availableSeats} available seats (${occupancyRate}% occupied) - ₩${section.price.toLocaleString()}`);
    }

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await redisClient.quit();
    await AppDataSource.destroy();
  }
}

// Run the seed function
seedSections();