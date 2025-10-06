import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('MainLogger');

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors();

  const PORT = process.env.PORT ?? 3000;

  await app.listen(PORT);

  logger.log(`Application is running on port: ${PORT} `);
}
bootstrap();
