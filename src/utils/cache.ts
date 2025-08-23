import { redisClient } from '../config/redis';

export class CacheService {
  private static readonly DEFAULT_TTL = 300; // 5 minutes

  static async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  static async set(key: string, value: any, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      await redisClient.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }

  static async delete(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }

  static async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch (error) {
      console.error(`Cache delete pattern error for ${pattern}:`, error);
    }
  }

  static async invalidateSeatCache(seatId?: string): Promise<void> {
    if (seatId) {
      await this.delete(`seat:${seatId}`);
    }
    await this.deletePattern('seats:*');
  }

  static async invalidateReservationCache(reservationId?: string, userId?: string): Promise<void> {
    if (reservationId) {
      await this.delete(`reservation:${reservationId}`);
    }
    if (userId) {
      await this.deletePattern(`user:${userId}:reservations:*`);
    }
  }
}