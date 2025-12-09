import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('MainLogger');

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('v1');
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use((req, res, next) => {
    req.setTimeout(60000);
    next();
  });

  const PORT = process.env.PORT ?? 3000;

  await app.listen(PORT);

  logger.log(`Application is running on port: ${PORT} `);
}
bootstrap();
