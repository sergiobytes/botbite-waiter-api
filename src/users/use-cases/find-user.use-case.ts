import { isUUID } from 'class-validator';
import { FindUser, UserResponse } from '../interfaces/users.interfaces';
import { NotFoundException } from '@nestjs/common';

export const findUserUseCase = async (
  params: FindUser,
): Promise<UserResponse> => {
  const { term, lang, repository, translationService } = params;

  const user = await repository.findOne({
    where: isUUID(term) ? [{ id: term }, { email: term }] : { email: term },
    select: {
      id: true,
      email: true,
      password: true,
      roles: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new NotFoundException(
      translationService.translate('errors.user_not_found', lang),
    );
  }

  return {
    user,
    message: translationService.translate('users.user_found', lang),
  };
};
