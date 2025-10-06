import { Body, Controller, Get, Ip, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginThrottleGuard } from './guards/login-throttle.guard';
import { Lang } from '../common/decorators/lang.decorator';
import { LoginUserDto } from './dto/login-user.dto';
import { AccessTokenGuard } from './guards/access-token.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginThrottleGuard: LoginThrottleGuard,
  ) {}

  @Post('login')
  @UseGuards(LoginThrottleGuard)
  async login(
    @Ip() ip: string,
    @Lang() lang: string,
    @Body() loginUserDto: LoginUserDto,
  ) {
    try {
      const result = await this.authService.login(loginUserDto, lang, ip);
      this.loginThrottleGuard.clearFailedAttempts(ip);
      return result;
    } catch (error) {
      this.loginThrottleGuard.recordFailedAttempt(ip);
      throw error;
    }
  }

  @Get('validate-token')
  @UseGuards(AccessTokenGuard, JwtAuthGuard)
  validateToken(@CurrentUser() user: User) {
    return {
      valid: true,
      user: {
        email: user.email,
        roles: user.roles,
      },
    };
  }

  @Post('refresh-token')
  @UseGuards(RefreshTokenGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 refresh por minuto
  refreshToken(
    @Body('refreshToken') refreshToken: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    return this.authService.refreshToken(refreshToken, user, lang);
  }
}
