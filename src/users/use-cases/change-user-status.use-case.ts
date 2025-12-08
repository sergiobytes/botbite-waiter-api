import { BadRequestException } from '@nestjs/common';
import { ChangeUserStatus, UserResponse } from '../interfaces/users.interfaces';
import { findUserUseCase } from './find-user.use-case';

export const changeUserStatusUseCase = async (
  params: ChangeUserStatus,
): Promise<UserResponse> => {
  const { userId, lang, status, repository, translationService, logger } =
    params;

  const { user } = await findUserUseCase({
    lang,
    repository,
    term: userId,
    translationService,
  });

  if (user.isActive === true && status === true) {
    logger.warn(`Activate user failed - User already active: ${user.email}`);
    throw new BadRequestException(
      translationService.translate('users.user_already_active', lang),
    );
  } else if (user.isActive === false && status === false) {
    logger.warn(
      `Deactivate user failed - User already inactive: ${user.email}`,
    );
    throw new BadRequestException(
      translationService.translate('users.user_already_inactive', lang),
    );
  }

  user.isActive = status;
  await repository.save(user);

  logger.log(`User ${status ? 'activated' : 'deactivated'}: ${user.email}`);

  return {
    user: user,
    message: translationService.translate(
      status ? 'users.user_activated' : 'users.user_deactivated',
      lang,
    ),
  };
};
