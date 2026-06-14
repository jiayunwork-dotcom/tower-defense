import { Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleInit {
  private client: Redis | null = null;
  private enabled: boolean = true;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get('REDIS_HOST', 'localhost');
    const port = this.configService.get('REDIS_PORT', 6379);
    
    try {
      this.client = new Redis({
        host,
        port: Number(port),
        retryStrategy: (times) => {
          // 最多重试 5 次，之后禁用 Redis（使用内存存储）
          if (times > 5) {
            console.log('[Redis] Max retries exceeded, disabling Redis');
            this.enabled = false;
            if (this.client) {
              this.client.disconnect();
              this.client = null;
            }
            return null;
          }
          return Math.min(times * 200, 3000);
        },
        lazyConnect: false,
        enableOfflineQueue: true,
        connectTimeout: 3000,
      });

      this.client.on('connect', () => {
        console.log('[Redis] Connected successfully');
        this.enabled = true;
      });

      this.client.on('error', (err: any) => {
        if (this.enabled) {
          console.error('[Redis] Connection error (will retry):', err.message);
        }
      });

      this.client.on('close', () => {
        if (this.enabled) {
          console.log('[Redis] Connection closed');
        }
      });
    } catch (err: any) {
      console.warn('[Redis] Failed to initialize Redis client, running in-memory mode:', err.message);
      this.enabled = false;
      this.client = null;
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  private inMemoryStore: Map<string, any> = new Map();

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.isEnabled()) {
      this.inMemoryStore.set(key, value);
      return;
    }
    if (ttl) {
      await this.client!.set(key, value, 'EX', ttl);
    } else {
      await this.client!.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isEnabled()) {
      const val = this.inMemoryStore.get(key);
      return val !== undefined ? val : null;
    }
    return this.client!.get(key);
  }

  async del(key: string): Promise<void> {
    if (!this.isEnabled()) {
      this.inMemoryStore.delete(key);
      return;
    }
    await this.client!.del(key);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    if (!this.isEnabled()) {
      let hash = this.inMemoryStore.get(key);
      if (!hash) { hash = {}; this.inMemoryStore.set(key, hash); }
      hash[field] = value;
      return;
    }
    await this.client!.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    if (!this.isEnabled()) {
      const hash = this.inMemoryStore.get(key);
      return hash && hash[field] ? hash[field] : null;
    }
    return this.client!.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    if (!this.isEnabled()) {
      return this.inMemoryStore.get(key) || {};
    }
    return this.client!.hgetall(key);
  }

  async hdel(key: string, field: string): Promise<void> {
    if (!this.isEnabled()) {
      const hash = this.inMemoryStore.get(key);
      if (hash) { delete hash[field]; }
      return;
    }
    await this.client!.hdel(key, field);
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.isEnabled()) {
      let set = this.inMemoryStore.get(key);
      if (!set) { set = new Set(); this.inMemoryStore.set(key, set); }
      let added = 0;
      members.forEach(m => { if (!set.has(m)) { set.add(m); added++; } });
      return added;
    }
    return this.client!.sadd(key, ...members);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    if (!this.isEnabled()) {
      const set = this.inMemoryStore.get(key);
      if (!set) return 0;
      let removed = 0;
      members.forEach(m => { if (set.has(m)) { set.delete(m); removed++; } });
      return removed;
    }
    return this.client!.srem(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.isEnabled()) {
      const set = this.inMemoryStore.get(key);
      return set ? Array.from(set) : [];
    }
    return this.client!.smembers(key);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isEnabled()) {
      return this.inMemoryStore.has(key);
    }
    const result = await this.client!.exists(key);
    return result === 1;
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isEnabled()) {
      setTimeout(() => this.inMemoryStore.delete(key), seconds * 1000);
      return true;
    }
    const result = await this.client!.expire(key, seconds);
    return result === 1;
  }
}
