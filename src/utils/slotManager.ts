import { redisClient } from '../config/redis';

export enum SlotStatus {
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  CONFIRMED = 'confirmed'
}

export interface SlotInfo {
  slotId: string;
  status: SlotStatus;
  reservationId?: string;
  reservedAt?: Date;
  expiresAt?: Date;
}

export interface SlotMetadata {
  totalSlots: number;
  seatsPerSlot: number;
  totalCapacity: number;
}

export class SlotManager {
  private static readonly SLOT_PREFIX = 'section:slot:';
  private static readonly SLOT_META_PREFIX = 'section:slot:meta:';
  private static readonly SLOT_INDEX_PREFIX = 'section:slot:index:';
  private static readonly DEFAULT_SLOTS_COUNT = 10; // Default number of slots per section
  private static readonly RESERVATION_TTL = 900; // 15 minutes in seconds

  /**
   * Initialize slots for a section
   * Each slot represents exactly one seat (1:1 mapping)
   */
  static async initializeSlots(sectionId: string, totalCapacity: number, slotsCount?: number): Promise<void> {
    // Always use 1:1 mapping (1 slot = 1 seat)
    const numSlots = totalCapacity;
    const seatsPerSlot = 1;
    
    // Save slot metadata
    const metaKey = this.getMetaKey(sectionId);
    await redisClient.hset(metaKey, {
      totalSlots: numSlots.toString(),
      seatsPerSlot: seatsPerSlot.toString(),
      totalCapacity: totalCapacity.toString()
    });

    // Initialize slots in batches for better performance
    const BATCH_SIZE = 1000;
    const batches = Math.ceil(numSlots / BATCH_SIZE);
    
    for (let batch = 0; batch < batches; batch++) {
      const pipeline = redisClient.pipeline();
      const start = batch * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, numSlots);
      
      // Initialize slots in this batch
      for (let i = start; i < end; i++) {
        const slotKey = this.getSlotKey(sectionId, i.toString());
        pipeline.hset(slotKey, {
          status: SlotStatus.AVAILABLE,
          slotId: i.toString(),
          seatNumber: (i + 1).toString() // Human-readable seat number
        });
      }
      
      // Add to available index
      const indexKey = this.getIndexKey(sectionId, SlotStatus.AVAILABLE);
      const slotIds = Array.from({ length: end - start }, (_, idx) => (start + idx).toString());
      pipeline.sadd(indexKey, ...slotIds);
      
      await pipeline.exec();
    }
  }

  /**
   * Reserve slots for a reservation
   * With 1:1 mapping, quantity equals the number of slots needed
   */
  static async reserveSlots(
    sectionId: string, 
    quantity: number, 
    reservationId: string
  ): Promise<string[]> {
    const metadata = await this.getSlotMetadata(sectionId);
    if (!metadata) {
      throw new Error('Section slots not initialized');
    }

    // With 1:1 mapping, slots needed = quantity
    const slotsNeeded = quantity;
    const reservedSlots: string[] = [];

    // Try to reserve required number of slots
    for (let i = 0; i < slotsNeeded; i++) {
      const slotId = await this.reserveSingleSlot(sectionId, reservationId);
      if (slotId) {
        reservedSlots.push(slotId);
      } else {
        // If we can't reserve enough slots, release already reserved ones
        await this.releaseSlots(sectionId, reservedSlots, reservationId);
        throw new Error('Not enough available slots');
      }
    }

    return reservedSlots;
  }

  /**
   * Reserve a single available slot atomically
   */
  private static async reserveSingleSlot(sectionId: string, reservationId: string): Promise<string | null> {
    console.log('reserveSingleSlot')
    const availableIndexKey = this.getIndexKey(sectionId, SlotStatus.AVAILABLE);
    const reservedIndexKey = this.getIndexKey(sectionId, SlotStatus.RESERVED);
    
    // Lua script to atomically move a slot from available to reserved
    const script = `
      local availableKey = KEYS[1]
      local reservedKey = KEYS[2]
      local reservationId = ARGV[1]
      local ttl = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      
      -- Get a random available slot
      local slotId = redis.call('srandmember', availableKey)
      if not slotId then
        return nil
      end
      
      -- Remove from available index
      redis.call('srem', availableKey, slotId)
      
      -- Add to reserved index
      redis.call('sadd', reservedKey, slotId)
      
      -- Update slot data
      local slotKey = KEYS[3] .. slotId
      redis.call('hset', slotKey, 
        'status', 'reserved',
        'reservationId', reservationId,
        'reservedAt', now,
        'expiresAt', now + ttl
      )
      
      -- Set expiration for auto-release
      redis.call('expire', slotKey, ttl)
      
      return slotId
    `;

    const now = Date.now();
    const slotKeyPrefix = this.getSlotKey(sectionId, '');
    
    const slotId = await redisClient.eval(
      script, 
      3, 
      availableIndexKey, 
      reservedIndexKey,
      slotKeyPrefix,
      reservationId,
      this.RESERVATION_TTL.toString(),
      now.toString()
    ) as string | null;

    return slotId;
  }

  /**
   * Confirm reserved slots
   */
  static async confirmSlots(sectionId: string, slotIds: string[], _reservationId: string): Promise<void> {
    const reservedIndexKey = this.getIndexKey(sectionId, SlotStatus.RESERVED);
    const confirmedIndexKey = this.getIndexKey(sectionId, SlotStatus.CONFIRMED);
    
    const pipeline = redisClient.pipeline();
    
    for (const slotId of slotIds) {
      const slotKey = this.getSlotKey(sectionId, slotId);
      
      // Update slot status
      pipeline.hset(slotKey, {
        status: SlotStatus.CONFIRMED,
        confirmedAt: Date.now().toString()
      });
      
      // Remove expiration
      pipeline.persist(slotKey);
      
      // Move from reserved to confirmed index
      pipeline.srem(reservedIndexKey, slotId);
      pipeline.sadd(confirmedIndexKey, slotId);
    }
    
    await pipeline.exec();
  }

  /**
   * Release slots (for cancellation or expiration)
   */
  static async releaseSlots(sectionId: string, slotIds: string[], _reservationId: string): Promise<void> {
    const availableIndexKey = this.getIndexKey(sectionId, SlotStatus.AVAILABLE);
    
    const pipeline = redisClient.pipeline();
    
    for (const slotId of slotIds) {
      const slotKey = this.getSlotKey(sectionId, slotId);
      
      // Get current status to determine which index to remove from
      const currentStatus = await redisClient.hget(slotKey, 'status');
      
      if (currentStatus && currentStatus !== SlotStatus.AVAILABLE) {
        const currentIndexKey = this.getIndexKey(sectionId, currentStatus as SlotStatus);
        pipeline.srem(currentIndexKey, slotId);
      }
      
      // Reset slot to available
      pipeline.hset(slotKey, {
        status: SlotStatus.AVAILABLE,
        slotId: slotId
      });
      pipeline.hdel(slotKey, 'reservationId', 'reservedAt', 'expiresAt', 'confirmedAt');
      
      // Add back to available index
      pipeline.sadd(availableIndexKey, slotId);
      
      // Remove expiration
      pipeline.persist(slotKey);
    }
    
    await pipeline.exec();
  }

  /**
   * Get available slots count
   */
  static async getAvailableSlotsCount(sectionId: string): Promise<number> {
    const availableIndexKey = this.getIndexKey(sectionId, SlotStatus.AVAILABLE);
    return await redisClient.scard(availableIndexKey);
  }

  /**
   * Get available seats count
   * With 1:1 mapping, available seats = available slots
   */
  static async getAvailableSeatsCount(sectionId: string): Promise<number> {
    // With 1:1 mapping, available seats equals available slots
    return await this.getAvailableSlotsCount(sectionId);
  }

  /**
   * Get slot metadata
   */
  static async getSlotMetadata(sectionId: string): Promise<SlotMetadata | null> {
    const metaKey = this.getMetaKey(sectionId);
    const data = await redisClient.hgetall(metaKey);
    
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    
    return {
      totalSlots: parseInt(data.totalSlots),
      seatsPerSlot: parseInt(data.seatsPerSlot),
      totalCapacity: parseInt(data.totalCapacity)
    };
  }

  /**
   * Get slots by reservation ID
   */
  static async getSlotsByReservation(sectionId: string, reservationId: string): Promise<string[]> {
    const metadata = await this.getSlotMetadata(sectionId);
    if (!metadata) return [];
    
    const slots: string[] = [];
    
    // Check all slots (this could be optimized with additional indexing)
    for (let i = 0; i < metadata.totalSlots; i++) {
      const slotKey = this.getSlotKey(sectionId, i.toString());
      const slotReservationId = await redisClient.hget(slotKey, 'reservationId');
      
      if (slotReservationId === reservationId) {
        slots.push(i.toString());
      }
    }
    
    return slots;
  }

  /**
   * Clean up expired slots
   */
  static async cleanupExpiredSlots(sectionId: string): Promise<number> {
    const reservedIndexKey = this.getIndexKey(sectionId, SlotStatus.RESERVED);
    const reservedSlotIds = await redisClient.smembers(reservedIndexKey);
    
    let expiredCount = 0;
    const now = Date.now();
    
    for (const slotId of reservedSlotIds) {
      const slotKey = this.getSlotKey(sectionId, slotId);
      const expiresAt = await redisClient.hget(slotKey, 'expiresAt');
      
      if (expiresAt && parseInt(expiresAt) < now) {
        const reservationId = await redisClient.hget(slotKey, 'reservationId');
        if (reservationId) {
          await this.releaseSlots(sectionId, [slotId], reservationId);
          expiredCount++;
        }
      }
    }
    
    return expiredCount;
  }

  /**
   * Get section slot statistics
   */
  static async getSlotStats(sectionId: string): Promise<Record<SlotStatus, number>> {
    const stats: Record<SlotStatus, number> = {
      [SlotStatus.AVAILABLE]: 0,
      [SlotStatus.RESERVED]: 0,
      [SlotStatus.CONFIRMED]: 0
    };
    
    for (const status of Object.values(SlotStatus)) {
      const indexKey = this.getIndexKey(sectionId, status);
      stats[status] = await redisClient.scard(indexKey);
    }
    
    return stats;
  }

  // Key generation helpers
  private static getSlotKey(sectionId: string, slotId: string): string {
    return `${this.SLOT_PREFIX}${sectionId}:${slotId}`;
  }

  private static getMetaKey(sectionId: string): string {
    return `${this.SLOT_META_PREFIX}${sectionId}`;
  }

  private static getIndexKey(sectionId: string, status: SlotStatus): string {
    return `${this.SLOT_INDEX_PREFIX}${sectionId}:${status}`;
  }
}