import { BadRequestException } from '@nestjs/common';
import { CreateUser, UserResponse } from '../interfaces/users.interfaces';
import { findUserUseCase } from './find-user.use-case';
import * as argon2 from 'argon2';

export const registerUserUseCase = async (
  params: CreateUser,
): Promise<UserResponse> => {
  const { dto, lang, logger, repository, translationService, role } = params;

  const { email, password } = dto;

  const [{ user }, hashedPassword] = await Promise.all([
    findUserUseCase({ term: email, lang, repository, translationService }),
    argon2.hash(password),
  ]);

  if (user) {
    logger.warn(`User registration failed - User exists: ${email}`);
    throw new BadRequestException(
      translationService.translate('errors.user_exists', lang),
    );
  }

  const newUser = repository.create({
    email,
    password: hashedPassword,
    roles: [role],
  });

  await repository.save(newUser);

  return {
    user: newUser,
    message: translationService.translate('auth.registration_success', lang),
  };
};
