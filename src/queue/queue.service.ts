import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { QUEUES } from './queue.constants';
import { Queue } from 'bullmq';
import { WebhookDataTwilio } from '../messages/models/webhook-data.twilio';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private redisConnection: any;

  constructor(
    @InjectQueue(QUEUES.INBOUND_MESSAGE)
    private readonly inboundMessageQueue: Queue,
  ) {}

  initializeRedis() {
    if (!this.redisConnection) {
      const redisUrl = process.env.REDIS_URL;
      const password = process.env.REDIS_PASSWORD;
      const tlsEnabled = process.env.REDIS_TLS === 'true';

      this.redisConnection = {
        url: redisUrl,
        password: password,
        ...(tlsEnabled ? { tls: {} } : {}),
      };

      this.logger.log('Redis connection initialized');
    }
  }

  async closeRedisConnection() {
    if (this.redisConnection) {
      await this.inboundMessageQueue.close();
      this.redisConnection = null;
      this.logger.log('Redis connection closed');
    }
  }

  async isQueueEmpty(): Promise<boolean> {
    const jobCounts = await this.inboundMessageQueue.getJobCounts();
    return jobCounts.waiting === 0 && jobCounts.active === 0;
  }

  async addInboundMessage(data: WebhookDataTwilio): Promise<void> {
    try {
      const job = await this.inboundMessageQueue.add(
        'process-incoming-message',
        data,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );

      this.logger.log(`Message queued with Job ID: ${job.id}`);
    } catch (error) {
      this.logger.error('Error adding message to queue', error);
      throw error;
    }
  }

  async getMetrics() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.inboundMessageQueue.getWaitingCount(),
      this.inboundMessageQueue.getActiveCount(),
      this.inboundMessageQueue.getCompletedCount(),
      this.inboundMessageQueue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active,
    };
  }
}
