import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis;
  private readonly defaultTTL: number;

  constructor(private readonly configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    const password = this.configService.get<string>('REDIS_PASSWORD');
    const tlsEnabled = this.configService.get<string>('REDIS_TLS') === 'true';
    this.defaultTTL = this.configService.get<number>('CACHE_TTL') || 300; // 5 minutos default

    this.redis = new Redis(redisUrl, {
      password: password || undefined,
      ...(tlsEnabled ? { tls: { rejectUnauthorized: false } } : {}),
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redis.on('connect', () => {
      this.logger.log('✅ Cache Redis connected successfully');
    });

    this.redis.on('error', (error) => {
      this.logger.error('❌ Cache Redis connection error:', error);
    });
  }

  /**
   * Genera un hash MD5 simple para keys de caché
   */
  private generateCacheKey(prefix: string, data: any): string {
    const crypto = require('crypto');
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(data))
      .digest('hex');
    return `${prefix}:${hash}`;
  }

  /**
   * Obtener respuesta de OpenAI desde caché
   * @param branchId - ID de la sucursal
   * @param userMessage - Mensaje del usuario
   * @param conversationContext - Contexto de la conversación (últimos 3 mensajes)
   */
  async getOpenAICachedResponse(
    branchId: string,
    userMessage: string,
    conversationContext?: string[],
  ): Promise<string | null> {
    try {
      const cacheKey = this.generateCacheKey('openai', {
        branchId,
        message: userMessage.toLowerCase().trim(),
        context: conversationContext?.slice(-3), // Solo últimos 3 mensajes
      });

      const cached = await this.redis.get(cacheKey);

      if (cached) {
        this.logger.log(`✅ Cache HIT for key: ${cacheKey}`);
        await this.incrementCacheHits();
        return cached;
      }

      this.logger.log(`❌ Cache MISS for key: ${cacheKey}`);
      await this.incrementCacheMisses();
      return null;
    } catch (error) {
      this.logger.error('Error getting from cache:', error);
      return null;
    }
  }

  /**
   * Guardar respuesta de OpenAI en caché
   */
  async setOpenAICachedResponse(
    branchId: string,
    userMessage: string,
    response: string,
    conversationContext?: string[],
    ttl?: number,
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey('openai', {
        branchId,
        message: userMessage.toLowerCase().trim(),
        context: conversationContext?.slice(-3),
      });

      await this.redis.setex(cacheKey, ttl || this.defaultTTL, response);
      this.logger.log(`✅ Cached response for key: ${cacheKey}`);
    } catch (error) {
      this.logger.error('Error setting cache:', error);
    }
  }

  /**
   * Rate limiting por usuario
   * @param phoneNumber - Número de teléfono del usuario
   * @param maxRequests - Máximo de requests permitidos
   * @param windowSeconds - Ventana de tiempo en segundos
   * @returns true si está permitido, false si excede el límite
   */
  async checkRateLimit(
    phoneNumber: string,
    maxRequests: number = 10,
    windowSeconds: number = 60,
  ): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    try {
      const key = `rate_limit:${phoneNumber}`;
      const current = await this.redis.incr(key);

      if (current === 1) {
        await this.redis.expire(key, windowSeconds);
      }

      const ttl = await this.redis.ttl(key);
      const allowed = current <= maxRequests;
      const remaining = Math.max(0, maxRequests - current);

      if (!allowed) {
        this.logger.warn(
          `⚠️ Rate limit exceeded for ${phoneNumber}: ${current}/${maxRequests}`,
        );
      }

      return {
        allowed,
        remaining,
        resetIn: ttl > 0 ? ttl : windowSeconds,
      };
    } catch (error) {
      this.logger.error('Error checking rate limit:', error);
      // En caso de error, permitir la request
      return { allowed: true, remaining: maxRequests, resetIn: windowSeconds };
    }
  }

  /**
   * Guardar datos temporales (ej: contexto de conversación)
   */
  async set(
    key: string,
    value: any,
    ttl: number = this.defaultTTL,
  ): Promise<void> {
    try {
      const serialized =
        typeof value === 'string' ? value : JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);
    } catch (error) {
      this.logger.error(`Error setting key ${key}:`, error);
    }
  }

  /**
   * Obtener datos temporales
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (!data) return null;

      try {
        return JSON.parse(data) as T;
      } catch {
        return data as T;
      }
    } catch (error) {
      this.logger.error(`Error getting key ${key}:`, error);
      return null;
    }
  }

  /**
   * Eliminar key
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Error deleting key ${key}:`, error);
    }
  }

  /**
   * Incrementar contador de cache hits
   */
  private async incrementCacheHits(): Promise<void> {
    await this.redis.incr('cache:stats:hits');
  }

  /**
   * Incrementar contador de cache misses
   */
  private async incrementCacheMisses(): Promise<void> {
    await this.redis.incr('cache:stats:misses');
  }

  /**
   * Obtener estadísticas de caché
   */
  async getCacheStats(): Promise<{
    hits: number;
    misses: number;
    hitRate: string;
  }> {
    try {
      const hits = parseInt((await this.redis.get('cache:stats:hits')) || '0');
      const misses = parseInt(
        (await this.redis.get('cache:stats:misses')) || '0',
      );
      const total = hits + misses;
      const hitRate = total > 0 ? ((hits / total) * 100).toFixed(2) : '0.00';

      return { hits, misses, hitRate: `${hitRate}%` };
    } catch (error) {
      this.logger.error('Error getting cache stats:', error);
      return { hits: 0, misses: 0, hitRate: '0%' };
    }
  }

  /**
   * Limpiar toda la caché
   */
  async flushCache(): Promise<void> {
    try {
      await this.redis.flushdb();
      this.logger.log('✅ Cache flushed successfully');
    } catch (error) {
      this.logger.error('Error flushing cache:', error);
    }
  }

  /**
   * Verificar salud de Redis
   */
  async healthCheck(): Promise<{ status: string; latency: number }> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      return {
        status: 'connected',
        latency,
      };
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return {
        status: 'disconnected',
        latency: -1,
      };
    }
  }

  async onModuleDestroy() {
    await this.redis.quit();
    this.logger.log('Redis connection closed');
  }
}
