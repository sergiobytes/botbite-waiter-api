import { Controller, Get } from '@nestjs/common';
import { CacheService } from '../common/services/cache.service';
import { QueueService } from '../queue/queue.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly queueService: QueueService,
  ) {}

  @Get()
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('redis')
  async redisHealth() {
    const health = await this.cacheService.healthCheck();
    return {
      status: health.status === 'connected' ? 'ok' : 'error',
      redis: health,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('queues')
  async queuesHealth() {
    try {
      const metrics = await this.queueService.getMetrics();
      return {
        status: 'ok',
        queues: {
          inboundMessages: metrics,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('cache/stats')
  async cacheStats() {
    const stats = await this.cacheService.getCacheStats();
    return {
      status: 'ok',
      cache: stats,
      timestamp: new Date().toISOString(),
    };
  }
}
