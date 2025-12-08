import { Logger } from '@nestjs/common';
import { RegisterUserDto } from '../dto/register-user.dto';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { TranslationService } from '../../common/services/translation.service';
import { UserRoles } from '../enums/user-roles';

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
