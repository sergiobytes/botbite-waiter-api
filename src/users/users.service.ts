import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { TranslationService } from '../common/services/translation.service';
import { isUUID } from 'class-validator';
import { RegisterUserDto } from './dto/register-user.dto';
import { UserRoles } from './enums/user-roles';

import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly translationService: TranslationService,
  ) {}

  async registerUser(registerUserDto: RegisterUserDto, lang: string) {
    const { email, password } = registerUserDto;

    const [userExists, hashedPassword] = await Promise.all([
      this.findUserByTerm(email),
      argon2.hash(password),
    ]);

    if (userExists) {
      this.logger.warn(`User registration failed - User exists: ${email}`);
      throw new BadRequestException(
        this.translationService.translate('errors.user_exists', lang),
      );
    }

    const user = this.userRepository.create({
      email,
      password: hashedPassword,
    });

    await this.userRepository.save(user);

    return {
      message: this.translationService.translate(
        'auth.registration_success',
        lang,
      ),
    };
  }

  async registerClient(registerUserDto: RegisterUserDto, lang: string) {
    const { email, password } = registerUserDto;

    const [userExists, hashedPassword] = await Promise.all([
      this.findUserByTerm(email),
      argon2.hash(password),
    ]);

    if (userExists) {
      this.logger.warn(`User registration failed - User exists: ${email}`);
      throw new BadRequestException(
        this.translationService.translate('errors.user_exists', lang),
      );
    }

    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      roles: [UserRoles.CLIENT],
    });

    await this.userRepository.save(user);

    return {
      message: this.translationService.translate(
        'auth.registration_success',
        lang,
      ),
    };
  }

  async activateUser(userId: string, lang: string) {
    const user = await this.findUserByTerm(userId);

    if (!user) {
      this.logger.warn(`Activate user failed - User not found: ${userId}`);
      throw new BadRequestException(
        this.translationService.translate('errors.user_not_found', lang),
      );
    }

    if (user.isActive) {
      this.logger.warn(
        `Activate user failed - User already active: ${user.email}`,
      );
      throw new BadRequestException(
        this.translationService.translate('users.user_already_active', lang),
      );
    }

    user.isActive = true;
    await this.userRepository.save(user);
    this.logger.log(`User activated: ${user.email}`);

    return {
      message: this.translationService.translate('users.user_activated', lang),
    };
  }

  async deactivateUser(userId: string, lang: string) {
    const user = await this.findUserByTerm(userId);

    if (!user) {
      this.logger.warn(`Activate user failed - User not found: ${userId}`);
      throw new BadRequestException(
        this.translationService.translate('errors.user_not_found', lang),
      );
    }

    if (!user.isActive) {
      this.logger.warn(
        `Activate user failed - User already inactive: ${user.email}`,
      );
      throw new BadRequestException(
        this.translationService.translate('users.user_already_inactive', lang),
      );
    }

    user.isActive = false;
    await this.userRepository.save(user);
    this.logger.log(`User deactivated: ${user.email}`);

    return {
      message: this.translationService.translate(
        'users.user_deactivated',
        lang,
      ),
    };
  }

  // TODO: Obtener usuarios paginados con el role client y con filtros (email, activos)

  // TODO: Agregar rol de administrador a un usuario que no tenga el rol de cliente y tiene que ser de un usuario activo y que ya sea administrador

  async findUserByTerm(term: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: isUUID(term) ? [{ id: term }, { email: term }] : { email: term },
      select: ['id', 'email', 'password', 'roles', 'createdAt', 'updatedAt'],
    });
  }

  sanitizeUserResponse(user: User) {
    return {
      id: user.id,
      email: user.email,
      roles: user.roles,
    };
  }
}
