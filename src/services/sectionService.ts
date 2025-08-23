import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Section, SectionStatus } from '../entities/Section';
import { CacheService } from '../utils/cache';
import { SeatCounter } from '../utils/seatCounter';
import { SlotManager } from '../utils/slotManager';
import { features } from '../config/features';

export class SectionService {
  private sectionRepository: Repository<Section>;

  constructor() {
    this.sectionRepository = AppDataSource.getRepository(Section);
  }

  async createSection(data: Partial<Section>): Promise<Section> {
    const section = this.sectionRepository.create(data);
    const savedSection = await this.sectionRepository.save(section);
    
    if (features.useSlotBasedReservation) {
      // Initialize slots for the section (1:1 mapping)
      await SlotManager.initializeSlots(savedSection.id, savedSection.totalCapacity);
    } else {
      // Initialize Redis counter
      await SeatCounter.initializeSection(savedSection.id, savedSection.totalCapacity);
    }
    
    await CacheService.delete('sections:all');
    return savedSection;
  }

  async findAvailableSections(): Promise<any[]> {
    const cacheKey = 'sections:available';
    const cached = await CacheService.get<any[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const sections = await this.sectionRepository.find({
      where: { status: SectionStatus.OPEN },
      order: { name: 'ASC' }
    });

    // Get available seats from Redis
    const sectionIds = sections.map(s => s.id);
    let availableSeatsMap: Map<string, number>;
    
    if (features.useSlotBasedReservation) {
      // Get available seats from slot system
      availableSeatsMap = new Map();
      for (const sectionId of sectionIds) {
        const availableSeats = await SlotManager.getAvailableSeatsCount(sectionId);
        availableSeatsMap.set(sectionId, availableSeats);
      }
    } else {
      // Get available seats from traditional counter
      availableSeatsMap = await SeatCounter.batchGetAvailableSeats(sectionIds);
    }

    const sectionsWithAvailability = sections.map(section => ({
      ...section,
      availableSeats: availableSeatsMap.get(section.id) ?? 
        (section.totalCapacity - section.currentOccupancy)
    }));

    await CacheService.set(cacheKey, sectionsWithAvailability, 30); // Cache for 30 seconds
    return sectionsWithAvailability;
  }

  async findSectionById(id: string): Promise<Section | null> {
    const cacheKey = `section:${id}`;
    const cached = await CacheService.get<Section>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const section = await this.sectionRepository.findOne({ where: { id } });
    
    if (section) {
      await CacheService.set(cacheKey, section, 300);
    }

    return section;
  }

  async getSectionWithAvailability(id: string): Promise<any> {
    const section = await this.findSectionById(id);
    if (!section) return null;

    let availableSeats: number | null;
    
    if (features.useSlotBasedReservation) {
      availableSeats = await SlotManager.getAvailableSeatsCount(id);
    } else {
      availableSeats = await SeatCounter.getAvailableSeats(id);
    }
    
    return {
      ...section,
      availableSeats: availableSeats ?? (section.totalCapacity - section.currentOccupancy)
    };
  }

  async updateSectionOccupancy(id: string, change: number): Promise<boolean> {
    const result = await this.sectionRepository
      .createQueryBuilder()
      .update(Section)
      .set({ 
        currentOccupancy: () => `current_occupancy + ${change}` 
      })
      .where('id = :id', { id })
      .andWhere('current_occupancy + :change >= 0', { change })
      .andWhere('current_occupancy + :change <= total_capacity', { change })
      .execute();

    if (result.affected && result.affected > 0) {
      await CacheService.delete(`section:${id}`);
      await CacheService.delete('sections:available');
      return true;
    }

    return false;
  }

  async syncRedisWithDatabase(): Promise<void> {
    const sections = await this.sectionRepository.find();
    
    for (const section of sections) {
      const availableSeats = section.totalCapacity - section.currentOccupancy;
      await SeatCounter.syncWithDatabase(section.id, availableSeats);
    }
  }

  async updateSectionStatus(id: string, status: SectionStatus): Promise<boolean> {
    const result = await this.sectionRepository.update(id, { status });
    
    if (result.affected && result.affected > 0) {
      await CacheService.delete(`section:${id}`);
      await CacheService.delete('sections:available');
      return true;
    }

    return false;
  }

  async getSectionStats(): Promise<any> {
    const stats = await this.sectionRepository
      .createQueryBuilder('section')
      .select('section.id', 'id')
      .addSelect('section.name', 'name')
      .addSelect('section.totalCapacity', 'totalCapacity')
      .addSelect('section.currentOccupancy', 'currentOccupancy')
      .addSelect('section.totalCapacity - section.currentOccupancy', 'availableSeats')
      .addSelect('ROUND((section.currentOccupancy::numeric / section.totalCapacity) * 100, 2)', 'occupancyRate')
      .where('section.status = :status', { status: SectionStatus.OPEN })
      .getRawMany();

    return stats;
  }
}