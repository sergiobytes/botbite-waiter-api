import { UserRoles } from '../../users/enums/user-roles';

export const canModifyBranchesUtil = (userRoles: UserRoles[]): boolean => {
  return (
    userRoles.includes(UserRoles.SUPER) || userRoles.includes(UserRoles.ADMIN)
  );
};
