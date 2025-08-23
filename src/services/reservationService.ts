import { Repository, EntityManager } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Reservation, ReservationStatus } from '../entities/Reservation';
import { Section, SectionStatus } from '../entities/Section';
import { ReservationLog, ReservationAction } from '../entities/ReservationLog';
import { SectionService } from './sectionService';
import { CacheService } from '../utils/cache';
import { SeatCounter } from '../utils/seatCounter';
import { withLock } from '../utils/distributedLock';
import crypto from 'crypto';

export class ReservationService {
  private reservationRepository: Repository<Reservation>;
  private sectionRepository: Repository<Section>;
  private reservationLogRepository: Repository<ReservationLog>;
  private sectionService: SectionService;

  constructor() {
    this.reservationRepository = AppDataSource.getRepository(Reservation);
    this.sectionRepository = AppDataSource.getRepository(Section);
    this.reservationLogRepository = AppDataSource.getRepository(ReservationLog);
    this.sectionService = new SectionService();
  }

  async createReservation(userId: string, sectionId: string, quantity: number): Promise<Reservation> {
    if (quantity < 1) {
      throw new Error('Quantity must be at least 1');
    }

    const lockKey = `reservation:create:${sectionId}`;
    
    return await withLock(lockKey, async () => {
      // First, try to reserve seats in Redis
      const reserved = await SeatCounter.reserveSeats(sectionId, quantity);
      
      if (!reserved) {
        throw new Error('Not enough available seats');
      }

      try {
        return await AppDataSource.transaction(async (manager: EntityManager) => {
          const section = await manager
            .createQueryBuilder(Section, 'section')
            .where('section.id = :id', { id: sectionId })
            .setLock('pessimistic_write')
            .getOne();

          if (!section) {
            throw new Error('Section not found');
          }

          if (section.status !== SectionStatus.OPEN) {
            throw new Error('Section is not open for reservations');
          }

          const availableSeats = section.totalCapacity - section.currentOccupancy;
          if (availableSeats < quantity) {
            throw new Error('Not enough seats available in database');
          }

          // Update section occupancy
          section.currentOccupancy += quantity;
          await manager.save(section);

          const expiresAt = new Date();
          expiresAt.setMinutes(expiresAt.getMinutes() + (parseInt(process.env.RESERVATION_TIMEOUT_MINUTES || '15')));

          const reservation = manager.create(Reservation, {
            userId,
            sectionId,
            quantity,
            status: ReservationStatus.PENDING,
            expiresAt,
            confirmationCode: this.generateConfirmationCode(),
            totalPrice: section.price ? Number(section.price) * quantity : undefined
          });

          const savedReservation = await manager.save(reservation);

          const log = manager.create(ReservationLog, {
            reservationId: savedReservation.id,
            action: ReservationAction.CREATED,
            performedBy: userId,
            metadata: { sectionId, quantity, userId }
          });
          await manager.save(log);

          await CacheService.delete(`section:${sectionId}`);
          await CacheService.delete('sections:available');
          await CacheService.invalidateReservationCache(undefined, userId);

          return savedReservation;
        });
      } catch (error) {
        // If database transaction fails, release the seats in Redis
        await SeatCounter.releaseSeats(sectionId, quantity);
        throw error;
      }
    }, { ttl: 10000, retries: 20 });
  }

  async confirmReservation(reservationId: string, userId: string): Promise<Reservation> {
    return await AppDataSource.transaction(async (manager: EntityManager) => {
      const reservation = await manager
        .createQueryBuilder(Reservation, 'reservation')
        .where('reservation.id = :id', { id: reservationId })
        .andWhere('reservation.userId = :userId', { userId })
        .setLock('pessimistic_write')
        .getOne();

      if (!reservation) {
        throw new Error('Reservation not found');
      }

      if (reservation.status !== ReservationStatus.PENDING) {
        throw new Error('Reservation cannot be confirmed');
      }

      if (new Date() > reservation.expiresAt) {
        throw new Error('Reservation has expired');
      }

      reservation.status = ReservationStatus.CONFIRMED;
      reservation.confirmedAt = new Date();

      await manager.save(reservation);

      const log = manager.create(ReservationLog, {
        reservationId: reservation.id,
        action: ReservationAction.CONFIRMED,
        performedBy: userId,
        metadata: { confirmationCode: reservation.confirmationCode }
      });
      await manager.save(log);

      await CacheService.invalidateReservationCache(reservationId, userId);

      return reservation;
    });
  }

  async cancelReservation(reservationId: string, userId: string): Promise<Reservation> {
    return await AppDataSource.transaction(async (manager: EntityManager) => {
      const reservation = await manager
        .createQueryBuilder(Reservation, 'reservation')
        .where('reservation.id = :id', { id: reservationId })
        .andWhere('reservation.userId = :userId', { userId })
        .setLock('pessimistic_write')
        .getOne();

      if (!reservation) {
        throw new Error('Reservation not found');
      }

      if (reservation.status === ReservationStatus.CANCELLED) {
        throw new Error('Reservation is already cancelled');
      }

      const section = await manager
        .createQueryBuilder(Section, 'section')
        .where('section.id = :id', { id: reservation.sectionId })
        .setLock('pessimistic_write')
        .getOne();

      if (!section) {
        throw new Error('Section not found');
      }

      // Release seats
      section.currentOccupancy -= reservation.quantity;
      await manager.save(section);

      // Update Redis counter
      await SeatCounter.releaseSeats(reservation.sectionId, reservation.quantity);

      reservation.status = ReservationStatus.CANCELLED;
      reservation.cancelledAt = new Date();

      await manager.save(reservation);

      const log = manager.create(ReservationLog, {
        reservationId: reservation.id,
        action: ReservationAction.CANCELLED,
        performedBy: userId
      });
      await manager.save(log);

      await CacheService.delete(`section:${section.id}`);
      await CacheService.delete('sections:available');
      await CacheService.invalidateReservationCache(reservationId, userId);

      return reservation;
    });
  }

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
        await AppDataSource.transaction(async (manager: EntityManager) => {
          const section = await manager
            .createQueryBuilder(Section, 'section')
            .where('section.id = :id', { id: reservation.sectionId })
            .setLock('pessimistic_write')
            .getOne();

          if (section) {
            section.currentOccupancy -= reservation.quantity;
            await manager.save(section);
            
            // Release seats in Redis
            await SeatCounter.releaseSeats(reservation.sectionId, reservation.quantity);
          }

          reservation.status = ReservationStatus.EXPIRED;
          await manager.save(reservation);

          const log = manager.create(ReservationLog, {
            reservationId: reservation.id,
            action: ReservationAction.EXPIRED,
            performedBy: 'system',
            metadata: { expiredAt: now }
          });
          await manager.save(log);

          await CacheService.delete(`section:${section?.id}`);
          await CacheService.delete('sections:available');
          await CacheService.invalidateReservationCache(reservation.id, reservation.userId);

          expiredCount++;
        });
      } catch (error) {
        console.error(`Failed to expire reservation ${reservation.id}:`, error);
      }
    }

    return expiredCount;
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