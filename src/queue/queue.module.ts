import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MessagesModule } from '../messages/messages.module';
import { QUEUES } from './queue.constants';
import { QueueService } from './queue.service';
import { InboundMessageProcessor } from './workers/inbound-message.processor';

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const redisUrl = cfg.get<string>('REDIS_URL');
        const password = cfg.get<string>('REDIS_PASSWORD');
        const tlsEnabled = cfg.get<boolean>('REDIS_TLS');
        const prefix = cfg.get<string>('QUEUE_PREFIX');

        return {
          connection: {
            url: redisUrl,
            password: password,
            ...(tlsEnabled ? { tls: {} } : {}),
          },
          prefix,
        };
      },
    }),
    BullModule.registerQueue({
      name: QUEUES.INBOUND_MESSAGE,
    }),
    forwardRef(() => MessagesModule),
  ],
  providers: [QueueService, InboundMessageProcessor],
  exports: [QueueService],
})
export class QueueModule {}
