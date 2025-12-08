import { Logger } from '@nestjs/common';
import { RegisterUserDto } from '../dto/register-user.dto';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { TranslationService } from '../../common/services/translation.service';
import { UserRoles } from '../enums/user-roles';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { FindUsersDto } from '../dto/find-users.dto';

export interface CreateUser {
  dto: RegisterUserDto;
  lang: string;
  logger: Logger;
  repository: Repository<User>;
  translationService: TranslationService;
  role: UserRoles;
}

export interface FindUser {
  term: string;
  lang: string;
  repository: Repository<User>;
  translationService: TranslationService;
}

export interface FindUsers {
  userId: string;
  paginationDto: PaginationDto;
  findUsersDto: FindUsersDto;
  repository: Repository<User>;
}

export interface ChangeUserStatus {
  userId: string;
  lang: string;
  status: boolean;
  repository: Repository<User>;
  translationService: TranslationService;
  logger: Logger;
}

export interface ManageUserAdminRole {
  userId: string;
  lang: string;
  addRole: boolean;
  repository: Repository<User>;
  translationService: TranslationService;
  logger: Logger;
}

export interface UserResponse {
  user: User;
  message: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    totalPages: number;
    currentPage: number;
  };
}
