import { Processor, WorkerHost } from '@nestjs/bullmq';
import { QUEUES } from '../queue.constants';
import { Logger } from '@nestjs/common';
import { MessagesService } from '../../messages/services/messages.service';
import { Job } from 'bullmq';
import { WebhookDataTwilio } from '../../messages/models/webhook-data.twilio';
import { QueueService } from '../queue.service';

@Processor(QUEUES.INBOUND_MESSAGE, { concurrency: 1 })
export class InboundMessageProcessor extends WorkerHost {
  private readonly logger = new Logger(InboundMessageProcessor.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly queueService: QueueService,
  ) {
    super();
  }

  async process(job: Job<WebhookDataTwilio>): Promise<void> {
    // this.logger.log(
    //   `Processing job ${job.id} (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`,
    // );
    // try {
    //   await this.messagesService.processIncomingMessage(job.data);
    //   this.logger.log(`Job ${job.id} completed successfully`);
    //   const isQueueEmpty = await this.queueService.isQueueEmpty();
    //   if (isQueueEmpty) await this.queueService.pauseQueue();
    // } catch (error) {
    //   this.logger.log(`Job ${job.id} failed: `, error);
    //   throw error;
    // }
  }
}
