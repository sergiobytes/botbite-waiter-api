import { BadRequestException } from '@nestjs/common';
import {
  ManageUserAdminRole,
  UserResponse,
} from '../interfaces/users.interfaces';
import { findUserUseCase } from './find-user.use-case';
import { UserRoles } from '../enums/user-roles';

export const manageUserAdminRoleUseCase = async (
  params: ManageUserAdminRole,
): Promise<UserResponse> => {
  const { userId, lang, addRole, repository, translationService, logger } =
    params;

  const { user } = await findUserUseCase({
    term: userId,
    lang,
    repository,
    translationService,
  });

  if (!user.isActive) {
    logger.warn(
      addRole
        ? `Add admin role failed - User is inactive: ${user.email}`
        : `Remove admin role failed - User is inactive: ${user.email}`,
    );
    throw new BadRequestException(
      translationService.translate('users.user_inactive', lang),
    );
  }

  if (user.roles.includes(UserRoles.CLIENT) && addRole) {
    logger.warn(`Add admin role failed - User is a client: ${user.email}`);
    throw new BadRequestException(
      translationService.translate('users.user_is_client', lang),
    );
  }

  if (user.roles.includes(UserRoles.ADMIN)) {
    logger.warn(
      `Add admin role failed - User already has admin role: ${user.email}`,
    );
    throw new BadRequestException(
      translationService.translate('users.user_already_admin', lang),
    );
  } else if (!user.roles.includes(UserRoles.ADMIN) && !addRole) {
    logger.warn(
      `Remove admin role failed - User doesn't have admin role: ${user.email}`,
    );
    throw new BadRequestException(
      translationService.translate('users.user_not_admin', lang),
    );
  }

  if (addRole) user.roles = [...user.roles, UserRoles.ADMIN];
  else user.roles = user.roles.filter((role) => role !== UserRoles.ADMIN);

  await repository.save(user);
  logger.log(
    addRole
      ? `Admin role added to user: ${user.email}`
      : `Admin role removed from user: ${user.email}`,
  );

  return {
    user,
    message: translationService.translate(
      addRole ? 'users.admin_role_added' : 'users.admin_role_removed',
      lang,
    ),
  };
};
