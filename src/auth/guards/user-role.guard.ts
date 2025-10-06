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
import { UserRoles } from '../../users/enums/user-roles';
import { User } from '../../users/entities/user.entity';

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

    const hasValidRole = user.roles.some((userRole) =>
      roles.includes(userRole),
    );

    if (hasValidRole) return true;

    throw new ForbiddenException(
      `User ${user.email} need a valid role [${roles.join(', ')}]`,
    );
  }
}
