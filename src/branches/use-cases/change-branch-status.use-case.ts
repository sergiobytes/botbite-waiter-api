import { BadRequestException } from '@nestjs/common';
import {
  ChangeBranchStatus,
  BranchResponse,
} from '../interfaces/branches.interfaces';
import { canModifyBranchesUtil } from '../utils/can-modify-branches.util';
import { findOneBranchUseCase } from './find-one-branch.use-case';

export const changeBranchStatusUseCase = async (
  params: ChangeBranchStatus,
): Promise<BranchResponse> => {
  const {
    user,
    repository,
    logger,
    translationService,
    branchId,
    restaurantId,
    status,
    lang,
  } = params;

  const { branch } = await findOneBranchUseCase({
    term: branchId,
    restaurantId,
    repository,
    logger,
    translationService,
    lang,
  });

  const canModifyAnyBranch = canModifyBranchesUtil(user.roles);

  const messages: string[] =
    status === true
      ? [
          `Activate failed - User ${user.id} tried to activate branch ${branch.id} not owned by them`,
          `Activate failed - Branch already active: ${branch.id}`,
          'branches.branch_already_active',
          'branches.branch_activated',
        ]
      : [
          `Deactivate failed - User ${user.id} tried to deactivate branch ${branch.id} not owned by them`,
          `Deactivate failed - Branch already inactive: ${branch.id}`,
          'branches.branch_already_inactive',
          'branches.branch_deactivated',
        ];

  if (!canModifyAnyBranch && branch.restaurant.user.id !== user.id) {
    logger.warn(messages[0]);
    throw new BadRequestException(
      translationService.translate('errors.branch_not_owned', lang),
    );
  }

  if (branch.isActive) {
    logger.warn(messages[1]);
    throw new BadRequestException(
      translationService.translate(messages[2], lang),
    );
  }

  branch.isActive = status;
  await repository.save(branch);

  logger.log(
    `Branch status changed to ${status}: ${branch.id} by user: ${user.email}`,
  );
  return {
    branch,
    message: translationService.translate(messages[3], lang),
  };
};
