import { Processor, WorkerHost } from '@nestjs/bullmq';
import { QUEUES } from '../queue.constants';
import { Logger } from '@nestjs/common';
import { MessagesService } from '../../messages/services/messages.service';
import { Job } from 'bullmq';
import { WebhookDataTwilio } from '../../messages/models/webhook-data.twilio';
import { QueueService } from '../queue.service';

@Processor(QUEUES.INBOUND_MESSAGE, {
  concurrency: 5, // Procesar hasta 5 mensajes en paralelo
  limiter: {
    max: 10, // Máximo 10 jobs
    duration: 1000, // por segundo
  },
})
export class InboundMessageProcessor extends WorkerHost {
  private readonly logger = new Logger(InboundMessageProcessor.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly queueService: QueueService,
  ) {
    super();
  }

  async process(job: Job<WebhookDataTwilio>): Promise<void> {
    const startTime = Date.now();
    this.logger.log(
      `🔄 Processing job ${job.id} (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`,
    );
    this.logger.log(`📞 From: ${job.data.From} | Message: ${job.data.Body}`);

    try {
      await this.messagesService.processIncomingMessage(job.data);

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Job ${job.id} completed successfully in ${duration}ms`,
      );

      // Verificar si la cola está vacía para pausarla y ahorrar recursos
      const isQueueEmpty = await this.queueService.isQueueEmpty();
      if (isQueueEmpty) {
        await this.queueService.pauseQueue();
        this.logger.log('⏸️  Queue is empty - paused to save resources');
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ Job ${job.id} failed after ${duration}ms:`,
        error.message,
      );
      throw error; // BullMQ manejará los reintentos automáticamente
    }
  }
}
