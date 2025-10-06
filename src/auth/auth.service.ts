import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TranslationService } from '../common/services/translation.service';
import { UsersService } from '../users/users.service';
import { LoginUserDto } from './dto/login-user.dto';

import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly translationService: TranslationService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginUserDto: LoginUserDto, lang: string, ip: string) {
    const { email, password } = loginUserDto;
    const loginStart = Date.now();

    this.logger.log(`Login attempt for user: ${email} from IP: ${ip}`);

    const user = await this.usersService.findUserByTerm(email);

    let loginTime: number;

    if (!user) {
      loginTime = Date.now() - loginStart;
      this.logger.warn(
        `Failed login attempt - User not found: ${email} from IP: ${ip} (${loginTime}ms)`,
      );
      throw new BadRequestException(
        this.translationService.translate('errors.user_not_found', lang),
      );
    }

    if (!user.isActive) {
      loginTime = Date.now() - loginStart;
      this.logger.warn(
        `Failed login attempt - User inactive: ${email} from IP: ${ip} (${loginTime}ms)`,
      );
      throw new BadRequestException(
        this.translationService.translate('errors.user_inactive', lang),
      );
    }

    const isValidPassword = await argon2.verify(user.password, password);

    if (!isValidPassword) {
      loginTime = Date.now() - loginStart;
      this.logger.warn(
        `Failed login attempt - Invalid credentials: ${email} from IP: ${ip} (${loginTime}ms)`,
      );
      throw new BadRequestException(
        this.translationService.translate('errors.invalid_credentials', lang),
      );
    }

    loginTime = Date.now() - loginStart;
    this.logger.log(
      `Successful login for user: ${email} (${user.roles.join(', ')}) from IP: ${ip} (${loginTime}ms)`,
    );

    const accessPayload = { userId: user.id, type: 'access' };
    const refreshPayload = { userId: user.id, type: 'refresh' };

    const accessToken = this.jwtService.sign(accessPayload);

    const refreshTokenExpiry = this.configService.get(
      'JWT_REFRESH_EXPIRY',
      '7d',
    );

    const refreshToken = this.jwtService.sign(refreshPayload, {
      expiresIn: refreshTokenExpiry,
    });

    return {
      message: this.translationService.translate('auth.welcome', lang),
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async refreshToken(refreshToken: string, currentUser: User, lang: string) {
    const refreshStart = Date.now();

    try {
      // Verificar el refresh token
      const payload = this.jwtService.verify(refreshToken);

      // Validar que sea un refresh token
      if (payload.type !== 'refresh') {
        this.logger.warn(
          `Invalid token type for refresh - User: ${currentUser.email}`,
        );
        throw new BadRequestException(
          this.translationService.translate('errors.invalid_token_type', lang),
        );
      }

      // Validar que el refresh token pertenezca al usuario autenticado
      if (payload.userId !== currentUser.id) {
        this.logger.warn(
          `Token user mismatch for refresh - User: ${currentUser.email}`,
        );
        throw new BadRequestException(
          this.translationService.translate('errors.token_user_mismatch', lang),
        );
      }

      // Validar que el usuario autenticado esté activo
      if (!currentUser.isActive) {
        this.logger.warn(
          `Inactive user attempted refresh - User: ${currentUser.email}`,
        );
        throw new BadRequestException(
          this.translationService.translate('errors.user_inactive', lang),
        );
      }

      // Buscar el usuario para asegurar que aún existe y está activo
      const user = await this.usersService.findUserByTerm(payload.userId);

      if (!user) {
        this.logger.warn(
          `User not found during refresh - User ID: ${payload.userId}`,
        );
        throw new BadRequestException(
          this.translationService.translate('errors.user_not_found', lang),
        );
      }

      if (!user.isActive) {
        this.logger.warn(
          `Inactive user in database during refresh - User: ${user.email}`,
        );
        throw new BadRequestException(
          this.translationService.translate('errors.user_inactive', lang),
        );
      }

      // Generar nuevos tokens
      const newAccessPayload = { userId: user.id, type: 'access' };
      const newRefreshPayload = { userId: user.id, type: 'refresh' };

      // El CustomJwtModule ya maneja JWT_ACCESS_EXPIRY automáticamente
      const newAccessToken = this.jwtService.sign(newAccessPayload);

      // Solo especificamos expiry para refresh token
      const refreshTokenExpiry = this.configService.get(
        'JWT_REFRESH_EXPIRY',
        '7d',
      );
      const newRefreshToken = this.jwtService.sign(newRefreshPayload, {
        expiresIn: refreshTokenExpiry,
      });

      const refreshTime = Date.now() - refreshStart;
      this.logger.log(
        `Token refreshed successfully for user: ${user.email} (${user.roles.join(', ')}) (${refreshTime}ms)`,
      );

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        user: this.usersService.sanitizeUserResponse(user),
      };
    } catch {
      const refreshTime = Date.now() - refreshStart;
      this.logger.warn(
        `Token refresh failed for user: ${currentUser.email} (${refreshTime}ms)`,
      );
      throw new BadRequestException(
        this.translationService.translate('errors.invalid_refresh_token', lang),
      );
    }
  }
}
