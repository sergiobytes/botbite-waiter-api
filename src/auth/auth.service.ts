import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TranslationService } from '../common/services/translation.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { LoginUserDto } from './dto/login-user.dto';
import {
  LoginResponse,
  RefreshTokenResponse,
} from './interfaces/auth.interfaces';
import { loginUseCase } from './use-cases/login.use-case';
import { refreshTokenUseCase } from './use-cases/refresh-token.use-case';
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly translationService: TranslationService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(
    loginUserDto: LoginUserDto,
    lang: string,
    ip: string,
  ): Promise<LoginResponse> {
    return await loginUseCase({
      dto: loginUserDto,
      logger: this.logger,
      ip,
      lang,
      configService: this.configService,
      userService: this.usersService,
      translationService: this.translationService,
      jwtService: this.jwtService,
    });
  }

  async refreshToken(
    refreshToken: string,
    currentUser: User,
    lang: string,
  ): Promise<RefreshTokenResponse> {
    return await refreshTokenUseCase({
      refreshToken,
      lang,
      currentUser,
      logger: this.logger,
      jwtService: this.jwtService,
      configService: this.configService,
      usersService: this.usersService,
      translationService: this.translationService,
    });
  }
}
