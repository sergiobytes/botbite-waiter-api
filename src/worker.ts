/**
 * ⚠️ BACKGROUND WORKER DESHABILITADO ⚠️
 * 
 * Este worker procesaba jobs de Redis queues (BullMQ).
 * 
 * Ya no se utiliza porque:
 * - El sistema de plantillas maneja mensajes sincrónicamente
 * - No hay necesidad de procesamiento en background
 * - Simplifica la arquitectura
 * 
 * Se puede restaurar si en el futuro se necesita procesamiento asíncrono.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('WorkerLogger');

  logger.log('⚠️ Background Worker está deshabilitado');
  logger.log('ℹ️ El procesamiento de mensajes ahora es síncrono');

  // ⚠️ Worker deshabilitado - código comentado ⚠️

  // logger.log('🚀 Starting Background Worker...');

  // const app = await NestFactory.createApplicationContext(AppModule);

  // logger.log('✅ Worker application context initialized');
  // logger.log('📡 Worker is now processing jobs from Redis queues');
  // logger.log('⏳ Press Ctrl+C to stop the worker');

  // // Mantener el worker corriendo
  // const shutdown = async () => {
  //   logger.log('📴 Shutting down worker gracefully...');
  //   await app.close();
  //   process.exit(0);
  // };

  // process.on('SIGINT', () => {
  //   void shutdown();
  // });

  // process.on('SIGTERM', () => {
  //   void shutdown();
  // });
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start worker:', error);
  process.exit(1);
});
