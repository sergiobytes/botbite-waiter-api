import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('WorkerLogger');

  const app = await NestFactory.createApplicationContext(AppModule);

  logger.log('Worker application context initialized');
}

bootstrap();
