import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { CommonModule } from '../common/common.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [CommonModule, QueueModule],
  controllers: [HealthController],
})
export class HealthModule {}
