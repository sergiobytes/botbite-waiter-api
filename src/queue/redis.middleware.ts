import { Injectable, NestMiddleware } from '@nestjs/common';
import { QueueService } from './queue.service';

@Injectable()
export class RedisMiddleware implements NestMiddleware {
  constructor(private readonly queueService: QueueService) {}

  async use(req: any, res: any, next: () => void) {
    // if (req.method === 'POST' && req.url.includes('webhook')) {
    //   this.queueService.initializeRedis();
    // }
    // next();
    // const isQueueEmpty = await this.queueService.isQueueEmpty();
    // if (isQueueEmpty) await this.queueService.closeRedisConnection();
  }
}
