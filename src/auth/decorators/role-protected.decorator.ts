import { SetMetadata } from '@nestjs/common';
import { UserRoles } from '../../users/enums/user-roles';

export const META_ROLES = 'role';

export const RoleProtected = (roles: UserRoles[]) => {
  return SetMetadata(META_ROLES, [...roles]);
};
