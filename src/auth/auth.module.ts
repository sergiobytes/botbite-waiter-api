import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LoginThrottleGuard } from './guards/login-throttle.guard';
import { CustomPassportModule } from '../custom-passport/custom-passport.module';
import { CustomJwtModule } from '../custom-jwt/custom-jwt.module';
import { CommonModule } from '../common/common.module';
import { UsersModule } from '../users/users.module';
import { ConfigModule } from '@nestjs/config';
import { LoginUseCase } from './use-cases/login.usecase';
import { RefreshTokenUseCase } from './use-cases/refresh-token.usecase';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LoginThrottleGuard,
    LoginUseCase,
    RefreshTokenUseCase
  ],
  imports: [
    ConfigModule,
    CustomPassportModule,
    CustomJwtModule,
    CommonModule,
    UsersModule,
  ],
  exports: [JwtStrategy, CustomPassportModule],
})
export class AuthModule { }
