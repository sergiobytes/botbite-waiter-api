import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { TranslationService } from '../common/services/translation.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { UserRoles } from './enums/user-roles';
import { FindUsersDto } from './dto/find-users.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { findUserUseCase } from './use-cases/find-user.use-case';
import { registerUserUseCase } from './use-cases/register-user.use-case';
import { changeUserStatusUseCase } from './use-cases/change-user-status.use-case';
import { manageUserAdminRoleUseCase } from './use-cases/manage-user-admin-role.use-case';
import { findAllUsersUseCase } from './use-cases/find-all-users.use-case';

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
    return findAllUsersUseCase({
      userId,
      paginationDto,
      findUsersDto,
      repository: this.userRepository,
    });
  }
}
