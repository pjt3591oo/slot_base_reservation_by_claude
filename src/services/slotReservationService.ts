import { Repository, EntityManager } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Reservation, ReservationStatus } from '../entities/Reservation';
import { Section, SectionStatus } from '../entities/Section';
import { ReservationLog, ReservationAction } from '../entities/ReservationLog';
import { CacheService } from '../utils/cache';
import { SlotManager } from '../utils/slotManager';
import crypto from 'crypto';

export class SlotReservationService {
  private reservationRepository: Repository<Reservation>;
  private sectionRepository: Repository<Section>;
  private reservationLogRepository: Repository<ReservationLog>;

  constructor() {
    this.reservationRepository = AppDataSource.getRepository(Reservation);
    this.sectionRepository = AppDataSource.getRepository(Section);
    this.reservationLogRepository = AppDataSource.getRepository(ReservationLog);
  }

  /**
   * Create a reservation using slot-based system
   * No global lock needed - slots handle concurrency
   */
  async createReservation(userId: string, sectionId: string, quantity: number): Promise<Reservation> {
    if (quantity < 1) {
      throw new Error('Quantity must be at least 1');
    }

    // Check section status first (no lock needed for read)
    const section = await this.sectionRepository.findOne({ where: { id: sectionId } });
    
    if (!section) {
      throw new Error('Section not found');
    }

    if (section.status !== SectionStatus.OPEN) {
      throw new Error('Section is not open for reservations');
    }

    let reservedSlots: string[] = [];
    let reservation: Reservation | undefined;

    try {
      // Create reservation in database first to get the ID
      reservation = await AppDataSource.transaction(async (manager: EntityManager) => {
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + (parseInt(process.env.RESERVATION_TIMEOUT_MINUTES || '15')));

        const newReservation = manager.create(Reservation, {
          userId,
          sectionId,
          quantity,
          status: ReservationStatus.PENDING,
          expiresAt,
          confirmationCode: this.generateConfirmationCode(),
          totalPrice: section.price ? Number(section.price) * quantity : undefined
        });

        const savedReservation = await manager.save(newReservation);
        return savedReservation;
      });

      // Now reserve slots with the reservation ID
      reservedSlots = await SlotManager.reserveSlots(sectionId, quantity, reservation!.id);

      // Update reservation with slot information
      await AppDataSource.transaction(async (manager: EntityManager) => {
        // Create log
        const log = manager.create(ReservationLog, {
          reservationId: reservation!.id,
          action: ReservationAction.CREATED,
          performedBy: userId,
          metadata: { 
            sectionId, 
            quantity, 
            userId,
            slots: reservedSlots 
          }
        });
        await manager.save(log);

        // Update section occupancy (for display purposes)
        await manager.update(Section, sectionId, {
          currentOccupancy: () => `"currentOccupancy" + ${quantity}`
        });

        // Invalidate caches
        await CacheService.delete(`section:${sectionId}`);
        await CacheService.delete('sections:available');
        await CacheService.invalidateReservationCache(undefined, userId);
      });

      return reservation;

    } catch (error) {
      // If anything fails, release the slots
      if (reservedSlots.length > 0 && reservation?.id) {
        await SlotManager.releaseSlots(sectionId, reservedSlots, reservation.id);
      }
      throw error;
    }
  }

  /**
   * Confirm reservation - no lock needed, just update slot status
   */
  async confirmReservation(reservationId: string, userId: string): Promise<Reservation> {
    // Get reservation first
    const reservation = await this.reservationRepository.findOne({
      where: { id: reservationId, userId }
    });

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (reservation.status !== ReservationStatus.PENDING) {
      throw new Error('Reservation cannot be confirmed');
    }

    if (new Date() > reservation.expiresAt) {
      throw new Error('Reservation has expired');
    }

    // Get slots for this reservation
    const slots = await SlotManager.getSlotsByReservation(reservation.sectionId, reservationId);
    
    if (slots.length === 0) {
      throw new Error('No slots found for reservation');
    }

    // Confirm slots first (atomic operation)
    await SlotManager.confirmSlots(reservation.sectionId, slots, reservationId);

    // Update reservation in database
    await AppDataSource.transaction(async (manager: EntityManager) => {
      reservation.status = ReservationStatus.CONFIRMED;
      reservation.confirmedAt = new Date();

      await manager.save(reservation);

      const log = manager.create(ReservationLog, {
        reservationId: reservation.id,
        action: ReservationAction.CONFIRMED,
        performedBy: userId,
        metadata: { 
          confirmationCode: reservation.confirmationCode,
          slots: slots
        }
      });
      await manager.save(log);

      await CacheService.invalidateReservationCache(reservationId, userId);
    });

    return reservation;
  }

  /**
   * Cancel reservation - release slots atomically
   */
  async cancelReservation(reservationId: string, userId: string): Promise<Reservation> {
    const reservation = await this.reservationRepository.findOne({
      where: { id: reservationId, userId }
    });

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new Error('Reservation is already cancelled');
    }

    // Get slots for this reservation
    const slots = await SlotManager.getSlotsByReservation(reservation.sectionId, reservationId);

    // Release slots first (atomic operation)
    if (slots.length > 0) {
      await SlotManager.releaseSlots(reservation.sectionId, slots, reservationId);
    }

    // Update database
    await AppDataSource.transaction(async (manager: EntityManager) => {
      // Update section occupancy
      await manager.update(Section, reservation.sectionId, {
        currentOccupancy: () => `GREATEST("currentOccupancy" - ${reservation.quantity}, 0)`
      });

      reservation.status = ReservationStatus.CANCELLED;
      reservation.cancelledAt = new Date();

      await manager.save(reservation);

      const log = manager.create(ReservationLog, {
        reservationId: reservation.id,
        action: ReservationAction.CANCELLED,
        performedBy: userId,
        metadata: { slots: slots }
      });
      await manager.save(log);

      await CacheService.delete(`section:${reservation.sectionId}`);
      await CacheService.delete('sections:available');
      await CacheService.invalidateReservationCache(reservationId, userId);
    });

    return reservation;
  }

  /**
   * Get available seats using slot system
   */
  async getAvailableSeats(sectionId: string): Promise<number> {
    return await SlotManager.getAvailableSeatsCount(sectionId);
  }

  /**
   * Expire reservations - runs periodically
   */
  async expireReservations(): Promise<number> {
    const now = new Date();
    
    const expiredReservations = await this.reservationRepository
      .createQueryBuilder('reservation')
      .where('reservation.status = :status', { status: ReservationStatus.PENDING })
      .andWhere('reservation.expiresAt < :now', { now })
      .getMany();

    let expiredCount = 0;

    for (const reservation of expiredReservations) {
      try {
        // Get and release slots
        const slots = await SlotManager.getSlotsByReservation(reservation.sectionId, reservation.id);
        
        if (slots.length > 0) {
          await SlotManager.releaseSlots(reservation.sectionId, slots, reservation.id);
        }

        await AppDataSource.transaction(async (manager: EntityManager) => {
          // Update section occupancy
          await manager.update(Section, reservation.sectionId, {
            currentOccupancy: () => `GREATEST("currentOccupancy" - ${reservation.quantity}, 0)`
          });

          reservation.status = ReservationStatus.EXPIRED;
          await manager.save(reservation);

          const log = manager.create(ReservationLog, {
            reservationId: reservation.id,
            action: ReservationAction.EXPIRED,
            performedBy: 'system',
            metadata: { 
              expiredAt: now,
              slots: slots 
            }
          });
          await manager.save(log);

          await CacheService.delete(`section:${reservation.sectionId}`);
          await CacheService.delete('sections:available');
          await CacheService.invalidateReservationCache(reservation.id, reservation.userId);

          expiredCount++;
        });
      } catch (error) {
        console.error(`Failed to expire reservation ${reservation.id}:`, error);
      }
    }

    // Also clean up any orphaned expired slots
    const sections = await this.sectionRepository.find();
    for (const section of sections) {
      try {
        const cleanedSlots = await SlotManager.cleanupExpiredSlots(section.id);
        if (cleanedSlots > 0) {
          console.log(`Cleaned up ${cleanedSlots} expired slots in section ${section.id}`);
        }
      } catch (error) {
        console.error(`Failed to cleanup slots for section ${section.id}:`, error);
      }
    }

    return expiredCount;
  }

  /**
   * Get section statistics including slot information
   */
  async getSectionStats(sectionId: string): Promise<any> {
    const section = await this.sectionRepository.findOne({ where: { id: sectionId } });
    if (!section) {
      throw new Error('Section not found');
    }

    const slotStats = await SlotManager.getSlotStats(sectionId);
    const metadata = await SlotManager.getSlotMetadata(sectionId);

    return {
      section: {
        id: section.id,
        name: section.name,
        totalCapacity: section.totalCapacity,
        currentOccupancy: section.currentOccupancy
      },
      slots: {
        metadata,
        stats: slotStats,
        availableSeats: await SlotManager.getAvailableSeatsCount(sectionId)
      }
    };
  }

  // Keep existing methods unchanged
  async getReservationById(id: string, userId: string): Promise<Reservation | null> {
    const cacheKey = `reservation:${id}`;
    
    const cachedReservation = await CacheService.get<Reservation>(cacheKey);
    if (cachedReservation && cachedReservation.userId === userId) {
      return cachedReservation;
    }

    const reservation = await this.reservationRepository.findOne({
      where: { id, userId },
      relations: ['section', 'user']
    });

    if (reservation) {
      await CacheService.set(cacheKey, reservation, 300);
    }

    return reservation;
  }

  async getUserReservations(userId: string, status?: ReservationStatus): Promise<Reservation[]> {
    const cacheKey = status 
      ? `user:${userId}:reservations:${status}` 
      : `user:${userId}:reservations:all`;
    
    const cachedReservations = await CacheService.get<Reservation[]>(cacheKey);
    if (cachedReservations) {
      return cachedReservations;
    }

    const queryBuilder = this.reservationRepository
      .createQueryBuilder('reservation')
      .leftJoinAndSelect('reservation.section', 'section')
      .where('reservation.userId = :userId', { userId });

    if (status) {
      queryBuilder.andWhere('reservation.status = :status', { status });
    }

    const reservations = await queryBuilder
      .orderBy('reservation.createdAt', 'DESC')
      .getMany();

    await CacheService.set(cacheKey, reservations, 60);
    return reservations;
  }

  async getReservationStats(sectionId?: string): Promise<any> {
    const queryBuilder = this.reservationRepository
      .createQueryBuilder('reservation')
      .select('reservation.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(reservation.quantity)', 'totalQuantity')
      .groupBy('reservation.status');

    if (sectionId) {
      queryBuilder.where('reservation.sectionId = :sectionId', { sectionId });
    }

    const stats = await queryBuilder.getRawMany();
    
    return stats.reduce((acc, stat) => {
      acc[stat.status] = {
        count: parseInt(stat.count),
        totalQuantity: parseInt(stat.totalquantity) || 0
      };
      return acc;
    }, {});
  }

  private generateConfirmationCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }
}