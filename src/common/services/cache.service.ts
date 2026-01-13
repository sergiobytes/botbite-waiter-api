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
   * Solo cachea consultas genéricas (menú, ingredientes, precios)
   * Consultas personalizadas (pedidos, cuenta) NO se cachean
   * @param branchId - ID de la sucursal
   * @param userMessage - Mensaje del usuario
   * @param conversationContext - Contexto de la conversación (últimos 3 mensajes)
   * @param phoneNumber - Número de teléfono del usuario (no usado en nueva implementación)
   */
  async getOpenAICachedResponse(
    branchId: string,
    userMessage: string,
    conversationContext?: string[],
    phoneNumber?: string,
  ): Promise<string | null> {
    try {
      // Detectar si es consulta genérica o personalizada
      const isGenericQuery = this.isGenericQuery(
        userMessage,
        conversationContext,
      );

      // Solo cachear consultas genéricas
      if (!isGenericQuery) {
        this.logger.log(
          `⏭️ SKIP CACHE (PERSONAL query): "${userMessage.substring(0, 50)}..."`,
        );
        return null;
      }

      // Cache compartido solo para consultas genéricas
      const cacheKey = this.generateCacheKey('openai', {
        branchId,
        message: userMessage.toLowerCase().trim(),
      });

      const cached = await this.redis.get(cacheKey);

      if (cached) {
        this.logger.log(`✅ Cache HIT (SHARED) for key: ${cacheKey}`);
        await this.incrementCacheHits();
        return cached;
      }

      this.logger.log(`❌ Cache MISS (SHARED) for key: ${cacheKey}`);
      await this.incrementCacheMisses();
      return null;
    } catch (error) {
      this.logger.error('Error getting from cache:', error);
      return null;
    }
  }

  /**
   * Guardar respuesta de OpenAI en caché
   * Solo cachea consultas genéricas (menú, ingredientes, precios)
   * Consultas personalizadas (pedidos, cuenta) NO se cachean
   */
  async setOpenAICachedResponse(
    branchId: string,
    userMessage: string,
    response: string,
    conversationContext?: string[],
    ttl?: number,
    phoneNumber?: string,
  ): Promise<void> {
    try {
      // Usar misma lógica de detección que en get
      const isGenericQuery = this.isGenericQuery(
        userMessage,
        conversationContext,
      );

      // Solo cachear consultas genéricas
      if (!isGenericQuery) {
        this.logger.log(
          `⏭️ SKIP CACHE SAVE (PERSONAL query): "${userMessage.substring(0, 50)}..."`,
        );
        return;
      }

      const cacheKey = this.generateCacheKey('openai', {
        branchId,
        message: userMessage.toLowerCase().trim(),
      });

      await this.redis.setex(cacheKey, ttl || this.defaultTTL, response);
      this.logger.log(`✅ Cached response (SHARED) for key: ${cacheKey}`);
    } catch (error) {
      this.logger.error('Error setting cache:', error);
    }
  }

  /**
   * Determina si una consulta es genérica (cacheable compartido) o personalizada
   * Soporta múltiples idiomas: Español, Inglés, Francés, Alemán, Italiano, Portugués, Coreano
   * @param message - Mensaje del usuario
   * @param context - Contexto de la conversación
   */
  private isGenericQuery(message: string, context?: string[]): boolean {
    const msg = message.toLowerCase();

    // Palabras clave genéricas (menú, precios, ingredientes) - MULTIIDIOMA
    const genericKeywords = [
      // Español
      'qué',
      'que',
      'cuál',
      'cual',
      'cuánto',
      'cuanto',
      'cómo',
      'como',
      'menú',
      'menu',
      'carta',
      'tiene',
      'tienes',
      'hay',
      'pizza',
      'hamburguesa',
      'bebida',
      'cerveza',
      'botana',
      'ingredientes',
      'lleva',
      'contiene',
      'precio',
      'cuesta',
      'opciones',
      'sabores',
      'tamaños',
      'tamaño',
      // Inglés
      'what',
      'which',
      'how much',
      'how many',
      'do you have',
      'menu',
      'price',
      'cost',
      'ingredients',
      'contains',
      'options',
      'flavors',
      'sizes',
      'size',
      // Francés
      'quel',
      'quelle',
      'combien',
      'avez-vous',
      'prix',
      // Alemán
      'was',
      'welche',
      'wie viel',
      'haben sie',
      'preis',
      // Italiano
      'cosa',
      'quale',
      'quanto',
      'prezzo',
      // Portugués
      'qual',
      'quanto',
      'tem',
      'preço',
      // Coreano
      '무엇',
      '뭐',
      '어떤',
      '얼마',
      '메뉴',
      '가격',
      '있어요',
      '있나요',
      '재료',
      '포함',
      '옵션',
      '크기',
    ];

    // Palabras de acción personalizada (hacer pedido, confirmar) - MULTIIDIOMA
    const personalKeywords = [
      // Español
      'quiero',
      'pedir',
      'ordenar',
      'confirmar',
      'agregar',
      'añadir',
      'cambiar',
      'cancelar',
      'cuenta',
      'pagar',
      'factura',
      'mesa',
      'mi pedido',
      'mi orden',
      'para llevar',
      // Inglés
      'i want',
      "i'd like",
      'order',
      'add',
      'confirm',
      'change',
      'cancel',
      'bill',
      'check',
      'pay',
      'my order',
      'table',
      'to go',
      'takeout',
      // Francés
      'je veux',
      'commander',
      'ajouter',
      'confirmer',
      'addition',
      // Alemán
      'ich möchte',
      'bestellen',
      'hinzufügen',
      'rechnung',
      // Italiano
      'voglio',
      'ordinare',
      'aggiungere',
      'conto',
      // Portugués
      'quero',
      'pedir',
      'adicionar',
      'conta',
      // Coreano
      '주문',
      '원해요',
      '원합니다',
      '추가',
      '확인',
      '변경',
      '취소',
      '계산',
      '결제',
      '테이블',
      '내 주문',
      '포장',
    ];

    // Si tiene palabras personalizadas, NO es genérico
    if (personalKeywords.some((keyword) => msg.includes(keyword))) {
      return false;
    }

    // Si tiene palabras genéricas y no es muy largo, es genérico
    if (
      genericKeywords.some((keyword) => msg.includes(keyword)) &&
      msg.length < 100
    ) {
      return true;
    }

    // Si ya hay contexto (conversación activa), es personalizado
    if (context && context.length > 0) {
      return false;
    }

    // Por defecto, mensajes cortos son genéricos
    return msg.length < 50;
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
      this.logger.log(`🔄 Checking rate limit for: ${phoneNumber}`);
      const key = `rate_limit:${phoneNumber}`;

      this.logger.log(`⏳ Calling Redis INCR...`);
      const current = await this.redis.incr(key);
      this.logger.log(`✅ INCR result: ${current}`);

      if (current === 1) {
        this.logger.log(`⏳ Setting EXPIRE...`);
        await this.redis.expire(key, windowSeconds);
        this.logger.log(`✅ EXPIRE set`);
      }

      this.logger.log(`⏳ Getting TTL...`);
      const ttl = await this.redis.ttl(key);
      this.logger.log(`✅ TTL: ${ttl}`);

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
