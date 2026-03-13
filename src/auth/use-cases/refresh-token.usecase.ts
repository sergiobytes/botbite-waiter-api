import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TranslationService } from '../../common/services/translation.service';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { sanitizeUserResponse } from '../../users/utils/sanitized-user.util';
import { RefreshTokenResponse, } from '../interfaces/auth.interfaces';

@Injectable()
export class RefreshTokenUseCase {
  private readonly logger = new Logger(RefreshTokenUseCase.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly translationService: TranslationService
  ) { }

  async execute(refreshToken: string, currentUser: User, lang: string): Promise<RefreshTokenResponse> {
    const refreshStart = Date.now();

    try {
      const payload = this.jwtService.verify(refreshToken);

      if (payload.type !== 'refresh') {
        this.logger.warn(
          `Invalid token type for refresh - User: ${currentUser.email}`,
        );
        throw new BadRequestException(
          this.translationService.translate('errors.invalid_token_type', lang),
        );
      }

      if (payload.userId !== currentUser.id) {
        this.logger.warn(
          `Token user mismatch for refresh - User: ${currentUser.email}`,
        );
        throw new BadRequestException(
          this.translationService.translate('errors.token_user_mismatch', lang),
        );
      }

      if (!currentUser.isActive) {
        this.logger.warn(
          `Inactive user attempted refresh - User: ${currentUser.email}`,
        );
        throw new BadRequestException(
          this.translationService.translate('errors.user_inactive', lang),
        );
      }

      const { user } = await this.usersService.findUserByTerm(payload.userId);

      if (!user) {
        this.logger.warn(`User not found during refresh - User ID: ${payload.userId}`);
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

      const newAccessPayload = { userId: user.id, type: 'access' };
      const newRefreshPayload = { userId: user.id, type: 'refresh' };

      const newAccessToken = this.jwtService.sign(newAccessPayload);

      const refreshTokenExpiry = this.configService.get('JWT_REFRESH_EXPIRY', '7d');
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
        user: sanitizeUserResponse(user),
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



