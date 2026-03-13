/**
 * ⚠️ QUEUE SERVICE DESHABILITADO ⚠️
 * 
 * Este servicio manejaba la cola de mensajes con BullMQ/Redis.
 * Ya no se utiliza - procesamiento ahora es síncrono.
 */

// import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
// import { QUEUES } from './queue.constants';
// import { Queue } from 'bullmq';
import { WebhookDataTwilio } from '../messages/models/webhook-data.twilio';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  // private redisConnection: any;

  constructor(
    // @InjectQueue(QUEUES.INBOUND_MESSAGE)
    // private readonly inboundMessageQueue: Queue,
  ) {
    this.logger.warn('⚠️ QueueService está deshabilitado - no se procesan colas');
  }

  // initializeRedis() {
  //   if (!this.redisConnection) {
  //     const redisUrl = process.env.REDIS_URL;
  //     const password = process.env.REDIS_PASSWORD;
  //     const tlsEnabled = process.env.REDIS_TLS === 'true';

  //     this.redisConnection = {
  //       url: redisUrl,
  //       password: password,
  //       ...(tlsEnabled ? { tls: { rejectUnauthorized: false } } : {}),
  //     };

  //     this.logger.log('Redis connection initialized');
  //   }
  // }

  async pauseQueue() {
    // No hace nada - queue deshabilitado
    // await this.inboundMessageQueue.pause();
    // this.logger.log('Inbound message queue paused');
  }

  async resumeQueue() {
    // No hace nada - queue deshabilitado
    // await this.inboundMessageQueue.resume();
    // this.logger.log('Inbound message queue resumed');
  }

  async closeRedisConnection() {
    // No hace nada - queue deshabilitado
    // if (this.redisConnection) {
    //   await this.inboundMessageQueue.close();
    //   this.redisConnection = null;
    //   this.logger.log('Redis connection closed');
    // }
  }

  async isQueueEmpty(): Promise<boolean> {
    // Siempre vacío - queue deshabilitado
    return true;
    // const jobCounts = await this.inboundMessageQueue.getJobCounts();
    // return jobCounts.waiting === 0 && jobCounts.active === 0;
  }

  async addInboundMessage(data: WebhookDataTwilio): Promise<void> {
    // No hace nada - queue deshabilitado
    this.logger.warn('⚠️ addInboundMessage llamado pero queue está deshabilitado');
    return;
    // try {
    //   this.logger.log(`🔄 Resuming queue before adding message...`);
    //   await this.resumeQueue();

    //   this.logger.log(`➕ Adding message to queue: ${data.From}`);
    //   const job = await this.inboundMessageQueue.add(
    //     'process-incoming-message',
    //     data,
    //     {
    //       attempts: 3,
    //       backoff: {
    //         type: 'exponential',
    //         delay: 2000,
    //       },
    //       removeOnComplete: 100,
    //       removeOnFail: 200,
    //     },
    //   );

    //   this.logger.log(`✅ Message queued with Job ID: ${job.id}`);
    // } catch (error) {
    //   this.logger.error('❌ Error adding message to queue:', error.message);
    //   this.logger.error('Stack:', error.stack);
    //   throw error;
    // }
  }

  async getMetrics() {
    // Retorna métricas vacías - queue deshabilitado
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      total: 0,
    };
    // const [waiting, active, completed, failed] = await Promise.all([
    //   this.inboundMessageQueue.getWaitingCount(),
    //   this.inboundMessageQueue.getActiveCount(),
    //   this.inboundMessageQueue.getCompletedCount(),
    //   this.inboundMessageQueue.getFailedCount(),
    // ]);

    // return {
    //   waiting,
    //   active,
    //   completed,
    //   failed,
    //   total: waiting + active,
    // };
  }
}
