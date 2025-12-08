import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TranslationService } from '../../common/services/translation.service';
import { User } from '../../users/entities/user.entity';
import { UserResponseSanitized } from '../../users/interfaces/user-response-sanitized.interface';
import { UsersService } from '../../users/users.service';
import { LoginUserDto } from '../dto/login-user.dto';

export interface LoginUseCase {
  lang: string;
  ip: string;
  dto: LoginUserDto;
  logger: Logger;
  jwtService: JwtService;
  configService: ConfigService;
  userService: UsersService;
  translationService: TranslationService;
}

export interface RefreshTokenUseCase {
  refreshToken: string;
  lang: string;
  currentUser: User;
  logger: Logger;
  jwtService: JwtService;
  configService: ConfigService;
  usersService: UsersService;
  translationService: TranslationService;
}

export interface LoginResponse {
  message: string;
  access_token: string;
  refresh_token: string;
}

export interface RefreshTokenResponse {
  user: UserResponseSanitized;
  access_token: string;
  refresh_token: string;
}
