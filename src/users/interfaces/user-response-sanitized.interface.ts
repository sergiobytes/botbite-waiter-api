import { UserRoles } from '../enums/user-roles';

export interface UserResponseSanitized {
  id: string;
  email: string;
  roles: UserRoles[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
