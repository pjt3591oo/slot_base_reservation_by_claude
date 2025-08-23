import { redisClient } from '../config/redis';

export class SeatCounter {
  private static readonly KEY_PREFIX = 'section:seats:';
  private static readonly LOCK_PREFIX = 'section:lock:';
  private static readonly LOCK_TTL = 5000; // 5 seconds

  static async initializeSection(sectionId: string, totalCapacity: number): Promise<void> {
    const key = this.getKey(sectionId);
    await redisClient.set(key, totalCapacity.toString());
  }

  static async getAvailableSeats(sectionId: string): Promise<number | null> {
    const key = this.getKey(sectionId);
    const value = await redisClient.get(key);
    return value ? parseInt(value, 10) : null;
  }

  static async reserveSeats(sectionId: string, quantity: number): Promise<boolean> {
    const key = this.getKey(sectionId);
    
    // Use Lua script for atomic operation
    const script = `
      local key = KEYS[1]
      local quantity = tonumber(ARGV[1])
      local current = tonumber(redis.call("get", key))
      
      if current == nil then
        return -1
      end
      
      if current >= quantity then
        redis.call("decrby", key, quantity)
        return current - quantity
      else
        return -2
      end
    `;

    const result = await redisClient.eval(script, 1, key, quantity) as number;
    
    if (result === -1) {
      throw new Error('Section not initialized in Redis');
    }
    
    return result >= 0;
  }

  static async releaseSeats(sectionId: string, quantity: number): Promise<void> {
    const key = this.getKey(sectionId);
    await redisClient.incrby(key, quantity);
  }

  static async syncWithDatabase(sectionId: string, availableSeats: number): Promise<void> {
    const key = this.getKey(sectionId);
    await redisClient.set(key, availableSeats.toString());
  }

  static async batchGetAvailableSeats(sectionIds: string[]): Promise<Map<string, number>> {
    if (sectionIds.length === 0) return new Map();

    const pipeline = redisClient.pipeline();
    const keys = sectionIds.map(id => this.getKey(id));
    
    keys.forEach(key => pipeline.get(key));
    
    const results = await pipeline.exec();
    const map = new Map<string, number>();
    
    if (results) {
      sectionIds.forEach((id, index) => {
        const [err, value] = results[index];
        if (!err && value) {
          map.set(id, parseInt(value as string, 10));
        }
      });
    }
    
    return map;
  }

  private static getKey(sectionId: string): string {
    return `${this.KEY_PREFIX}${sectionId}`;
  }

  static async removeSection(sectionId: string): Promise<void> {
    const key = this.getKey(sectionId);
    await redisClient.del(key);
  }
}