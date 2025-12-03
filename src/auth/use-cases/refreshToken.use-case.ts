import { BadRequestException } from '@nestjs/common';
import {
  RefreshTokenResponse,
  RefreshTokenUseCase,
} from '../interfaces/auth.interfaces';

export const refreshTokenUseCase = async (
  params: RefreshTokenUseCase,
): Promise<RefreshTokenResponse> => {
  const {
    refreshToken,
    lang,
    currentUser,
    logger,
    jwtService,
    configService,
    usersService,
    translationService,
  } = params;

  const refreshStart = Date.now();

  try {
    const payload = jwtService.verify(refreshToken);

    if (payload.type !== 'refresh') {
      logger.warn(
        `Invalid token type for refresh - User: ${currentUser.email}`,
      );
      throw new BadRequestException(
        translationService.translate('errors.invalid_token_type', lang),
      );
    }

    if (payload.userId !== currentUser.id) {
      logger.warn(
        `Token user mismatch for refresh - User: ${currentUser.email}`,
      );
      throw new BadRequestException(
        translationService.translate('errors.token_user_mismatch', lang),
      );
    }

    if (!currentUser.isActive) {
      logger.warn(
        `Inactive user attempted refresh - User: ${currentUser.email}`,
      );
      throw new BadRequestException(
        translationService.translate('errors.user_inactive', lang),
      );
    }

    const user = await usersService.findUserByTerm(payload.userId);

    if (!user) {
      logger.warn(`User not found during refresh - User ID: ${payload.userId}`);
      throw new BadRequestException(
        translationService.translate('errors.user_not_found', lang),
      );
    }

    if (!user.isActive) {
      logger.warn(
        `Inactive user in database during refresh - User: ${user.email}`,
      );
      throw new BadRequestException(
        translationService.translate('errors.user_inactive', lang),
      );
    }

    const newAccessPayload = { userId: user.id, type: 'access' };
    const newRefreshPayload = { userId: user.id, type: 'refresh' };

    const newAccessToken = jwtService.sign(newAccessPayload);

    const refreshTokenExpiry = configService.get('JWT_REFRESH_EXPIRY', '7d');
    const newRefreshToken = jwtService.sign(newRefreshPayload, {
      expiresIn: refreshTokenExpiry,
    });

    const refreshTime = Date.now() - refreshStart;
    logger.log(
      `Token refreshed successfully for user: ${user.email} (${user.roles.join(', ')}) (${refreshTime}ms)`,
    );

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      user: usersService.sanitizeUserResponse(user),
    };
  } catch {
    const refreshTime = Date.now() - refreshStart;
    logger.warn(
      `Token refresh failed for user: ${currentUser.email} (${refreshTime}ms)`,
    );
    throw new BadRequestException(
      translationService.translate('errors.invalid_refresh_token', lang),
    );
  }
};
