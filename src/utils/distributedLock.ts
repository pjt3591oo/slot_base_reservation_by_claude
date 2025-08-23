import { redisClient } from '../config/redis';

export class DistributedLock {
  private static readonly DEFAULT_TTL = 30000; // 30 seconds
  private static readonly RETRY_DELAY = 50; // 50ms
  private static readonly MAX_RETRIES = 100; // 5 seconds total

  static async acquire(
    key: string,
    ttl: number = this.DEFAULT_TTL,
    retries: number = this.MAX_RETRIES
  ): Promise<string | null> {
    const lockKey = `lock:${key}`;
    const lockValue = `${Date.now()}-${Math.random()}`;

    for (let i = 0; i < retries; i++) {
      const result = await redisClient.set(lockKey, lockValue, 'PX', ttl, 'NX');
      
      if (result === 'OK') {
        return lockValue;
      }

      await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
    }

    return null;
  }

  static async release(key: string, lockValue: string): Promise<boolean> {
    const lockKey = `lock:${key}`;
    
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await redisClient.eval(script, 1, lockKey, lockValue) as number;
    return result === 1;
  }

  static async extend(key: string, lockValue: string, ttl: number = this.DEFAULT_TTL): Promise<boolean> {
    const lockKey = `lock:${key}`;
    
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    const result = await redisClient.eval(script, 1, lockKey, lockValue, ttl) as number;
    return result === 1;
  }

  static async isLocked(key: string): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const result = await redisClient.exists(lockKey);
    return result === 1;
  }
}

export const withLock = async <T>(
  key: string,
  fn: () => Promise<T>,
  options: { ttl?: number; retries?: number } = {}
): Promise<T> => {
  const lockValue = await DistributedLock.acquire(key, options.ttl, options.retries);
  
  if (!lockValue) {
    throw new Error(`Failed to acquire lock for key: ${key}`);
  }

  try {
    return await fn();
  } finally {
    await DistributedLock.release(key, lockValue);
  }
};