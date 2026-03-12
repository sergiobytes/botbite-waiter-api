import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { CommonModule } from '../common/common.module';
// import { QueueModule } from '../queue/queue.module'; // ⚠️ Queue deshabilitado

@Module({
  imports: [
    CommonModule,
    // QueueModule, // ⚠️ Queue deshabilitado
  ],
  controllers: [HealthController],
})
export class HealthModule { }
