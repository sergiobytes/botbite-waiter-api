import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { QUEUES } from './queue.constants';
import { Queue } from 'bullmq';
import { WebhookDataTwilio } from '../messages/models/webhook-data.twilio';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUES.INBOUND_MESSAGE)
    private readonly inboundMessageQueue: Queue,
  ) {}

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
