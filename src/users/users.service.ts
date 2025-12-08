import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, ILike, ArrayContains } from 'typeorm';
import { User } from './entities/user.entity';
import { TranslationService } from '../common/services/translation.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { UserRoles } from './enums/user-roles';
import { FindUsersDto } from './dto/find-users.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UserResponseSanitized } from './interfaces/user-response-sanitized.interface';
import { findUserUseCase } from './use-cases/find-user.use-case';
import { registerUserUseCase } from './use-cases/register-user.use-case';
import { changeUserStatusUseCase } from './use-cases/change-user-status.use-case';
import { manageUserAdminRoleUseCase } from './use-cases/manage-user-admin-role.use-case';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly translationService: TranslationService,
  ) {}

  async registerUser(registerUserDto: RegisterUserDto, lang: string) {
    return registerUserUseCase({
      dto: registerUserDto,
      lang,
      logger: this.logger,
      repository: this.userRepository,
      translationService: this.translationService,
      role: UserRoles.USER,
    });
  }

  async registerClient(registerUserDto: RegisterUserDto, lang: string) {
    return registerUserUseCase({
      dto: registerUserDto,
      lang,
      logger: this.logger,
      repository: this.userRepository,
      translationService: this.translationService,
      role: UserRoles.CLIENT,
    });
  }

  async activateUser(userId: string, lang: string) {
    return changeUserStatusUseCase({
      userId,
      lang,
      status: true,
      logger: this.logger,
      repository: this.userRepository,
      translationService: this.translationService,
    });
  }

  async deactivateUser(userId: string, lang: string) {
    return changeUserStatusUseCase({
      userId,
      lang,
      status: false,
      logger: this.logger,
      repository: this.userRepository,
      translationService: this.translationService,
    });
  }

  async addAdminRoleToUser(userId: string, lang: string) {
    return manageUserAdminRoleUseCase({
      userId,
      lang,
      addRole: true,
      logger: this.logger,
      repository: this.userRepository,
      translationService: this.translationService,
    });
  }

  async removeAdminRoleFromUser(userId: string, lang: string) {
    return manageUserAdminRoleUseCase({
      userId,
      lang,
      addRole: false,
      logger: this.logger,
      repository: this.userRepository,
      translationService: this.translationService,
    });
  }

  async findUserByTerm(term: string) {
    return findUserUseCase({
      term,
      lang: 'es',
      repository: this.userRepository,
      translationService: this.translationService,
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
