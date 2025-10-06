import { applyDecorators, UseGuards } from '@nestjs/common';
import { UserRoles } from '../../users/enums/user-roles';
import { AuthGuard } from '@nestjs/passport';
import { RoleProtected } from './role-protected.decorator';
import { AccessTokenGuard } from '../guards/access-token.guard';
import { UserRoleGuard } from '../guards/user-role.guard';

export function Auth(roles: UserRoles[]) {
  return applyDecorators(
    RoleProtected(roles),
    UseGuards(AccessTokenGuard, AuthGuard('jwt'), UserRoleGuard),
  );
}
