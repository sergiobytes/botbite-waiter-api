import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { META_ROLES } from '../decorators/role-protected.decorator';
import { User } from '../../entities/user.entity';
import { UserRoles } from '../../entities/enums/user-valid-roles';

@Injectable()
export class UserRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const roles = this.reflector.get<UserRoles[]>(
      META_ROLES,
      context.getHandler(),
    );

    if (!roles) return true;

    const request = context.switchToHttp().getRequest();
    const user: User = request.user;

    if (!user) throw new BadRequestException('User not found');

    if (roles.includes(user.role)) return true;

    throw new ForbiddenException(
      `User ${user.name} need a valid role [${roles}]`,
    );
  }
}
