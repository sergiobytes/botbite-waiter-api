import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: 'default',
          ttl: parseInt(configService.get('THROTTLE_TTL', '60')) * 1000, // TTL en milisegundos
          limit: parseInt(configService.get('THROTTLE_LIMIT', '10')), // Límite por defecto
        },
        {
          name: 'login',
          ttl: parseInt(configService.get('THROTTLE_TTL', '60')) * 1000,
          limit: parseInt(configService.get('THROTTLE_LOGIN_LIMIT', '5')), // Límite más estricto para login
        },
      ],
    }),
  ],
  exports: [ThrottlerModule],
})
export class CustomThrottlerModule {}
