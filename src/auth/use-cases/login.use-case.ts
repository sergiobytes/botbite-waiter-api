import { BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { LoginResponse, LoginUseCase } from '../interfaces/auth.interfaces';

export const loginUseCase = async (
  params: LoginUseCase,
): Promise<LoginResponse> => {
  const {
    lang,
    ip,
    dto,
    logger,
    jwtService,
    configService,
    userService,
    translationService,
  } = params;
  const { email, password } = dto;

  const loginStart = Date.now();

  logger.log(`Login attempt for user: ${email} from IP: ${ip}`);

  const { user } = await userService.findUserByTerm(email);

  let loginTime: number;

  if (!user) {
    loginTime = Date.now() - loginStart;
    logger.warn(
      `Failed login attempt - User not found: ${email} from IP: ${ip} (${loginTime}ms)`,
    );

    throw new BadRequestException(
      translationService.translate('errors.user_not_found', lang),
    );
  }

  if (!user.isActive) {
    loginTime = Date.now() - loginStart;
    logger.warn(
      `Failed login attempt - User inactive: ${email} from IP: ${ip} (${loginTime}ms)`,
    );
    throw new BadRequestException(
      translationService.translate('errors.user_inactive', lang),
    );
  }

  const isValidPassword = await argon2.verify(user.password, password);

  if (!isValidPassword) {
    loginTime = Date.now() - loginStart;
    logger.warn(
      `Failed login attempt - Invalid credentials: ${email} from IP: ${ip} (${loginTime}ms)`,
    );
    throw new BadRequestException(
      translationService.translate('errors.invalid_credentials', lang),
    );
  }

  loginTime = Date.now() - loginStart;
  logger.log(
    `Successful login for user: ${email} (${user.roles.join(', ')}) from IP: ${ip} (${loginTime}ms)`,
  );

  const accessPayload = { userId: user.id, type: 'access' };
  const refreshPayload = { userId: user.id, type: 'refresh' };

  const accessToken = jwtService.sign(accessPayload);

  const refreshTokenExpiry = configService.get('JWT_REFRESH_EXPIRY', '7d');

  const refreshToken = jwtService.sign(refreshPayload, {
    expiresIn: refreshTokenExpiry,
  });

  return {
    message: translationService.translate('auth.welcome', lang),
    access_token: accessToken,
    refresh_token: refreshToken,
  };
};
