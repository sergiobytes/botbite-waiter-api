import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, ILike, ArrayContains } from 'typeorm';
import { User } from './entities/user.entity';
import { TranslationService } from '../common/services/translation.service';
import { isUUID } from 'class-validator';
import { RegisterUserDto } from './dto/register-user.dto';
import { UserRoles } from './enums/user-roles';
import { FindUsersDto } from './dto/find-users.dto';

import * as argon2 from 'argon2';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UserResponseSanitized } from './interfaces/user-response-sanitized.interface';

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

  async addAdminRoleToUser(userId: string, lang: string) {
    const user = await this.findUserByTerm(userId);

    if (!user) {
      this.logger.warn(`Add admin role failed - User not found: ${userId}`);
      throw new BadRequestException(
        this.translationService.translate('errors.user_not_found', lang),
      );
    }

    if (!user.isActive) {
      this.logger.warn(
        `Add admin role failed - User is inactive: ${user.email}`,
      );
      throw new BadRequestException(
        this.translationService.translate('users.user_inactive', lang),
      );
    }

    if (user.roles.includes(UserRoles.CLIENT)) {
      this.logger.warn(
        `Add admin role failed - User is a client: ${user.email}`,
      );
      throw new BadRequestException(
        this.translationService.translate('users.user_is_client', lang),
      );
    }

    if (user.roles.includes(UserRoles.ADMIN)) {
      this.logger.warn(
        `Add admin role failed - User already has admin role: ${user.email}`,
      );
      throw new BadRequestException(
        this.translationService.translate('users.user_already_admin', lang),
      );
    }

    user.roles = [...user.roles, UserRoles.ADMIN];
    await this.userRepository.save(user);
    this.logger.log(`Admin role added to user: ${user.email}`);
    return {
      message: this.translationService.translate(
        'users.admin_role_added',
        lang,
      ),
    };
  }

  async removeAdminRoleFromUser(userId: string, lang: string) {
    const user = await this.findUserByTerm(userId);

    if (!user) {
      this.logger.warn(`Remove admin role failed - User not found: ${userId}`);
      throw new BadRequestException(
        this.translationService.translate('errors.user_not_found', lang),
      );
    }

    if (!user.isActive) {
      this.logger.warn(
        `Remove admin role failed - User is inactive: ${user.email}`,
      );
      throw new BadRequestException(
        this.translationService.translate('users.user_inactive', lang),
      );
    }

    if (!user.roles.includes(UserRoles.ADMIN)) {
      this.logger.warn(
        `Remove admin role failed - User doesn't have admin role: ${user.email}`,
      );
      throw new BadRequestException(
        this.translationService.translate('users.user_not_admin', lang),
      );
    }

    user.roles = user.roles.filter((role) => role !== UserRoles.ADMIN);
    await this.userRepository.save(user);
    this.logger.log(`Admin role removed from user: ${user.email}`);

    return {
      message: this.translationService.translate(
        'users.admin_role_removed',
        lang,
      ),
    };
  }

  async findUserByTerm(term: string) {
    return await this.userRepository.findOne({
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
  }

  async findAllUsers(
    userId: string,
    paginationDto: PaginationDto,
    findUsersDto: FindUsersDto = {},
  ) {
    const { limit = 10, offset = 0 } = paginationDto;
    const { email, search, role } = findUsersDto;

    const whereConditions: any = {
      id: Not(userId),
    };

    if (email) {
      whereConditions.email = email;
    } else if (search) {
      whereConditions.email = ILike(`%${search}%`);
    }

    if (role) {
      whereConditions.roles = ArrayContains([role]);
    }

    const [users, total] = await this.userRepository.findAndCount({
      where: whereConditions,
      select: {
        id: true,
        email: true,
        roles: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    const sanitizedUsers = users.map((user) => this.sanitizeUserResponse(user));

    return {
      users: sanitizedUsers,
      total,
      pagination: {
        limit,
        offset,
        totalPages: Math.ceil(total / limit),
        currentPage: Math.floor(offset / limit) + 1,
      },
    };
  }

  sanitizeUserResponse(user: User): UserResponseSanitized {
    return {
      id: user.id,
      email: user.email,
      roles: user.roles,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
