import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
            secret: configService.get<string>('JWT_SECRET'),
            signOptions: {
                expiresIn: configService.get<string | number>('JWT_EXPIRES_IN'),
            },
        }
      }
    }),
  ],
  exports: [JwtModule],
})
export class CustomJwtModule {}
