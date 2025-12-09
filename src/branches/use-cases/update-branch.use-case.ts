import { BadRequestException } from '@nestjs/common';
import {
  BranchResponse,
  UpdateBranch,
} from '../interfaces/branches.interfaces';
import { findOneBranchUseCase } from './find-one-branch.use-case';
import { canModifyBranchesUtil } from '../utils/can-modify-branches.util';

export const updateBranchUseCase = async (
  params: UpdateBranch,
): Promise<BranchResponse> => {
  const {
    dto,
    user,
    repository,
    logger,
    translationService,
    branchId,
    restaurantId,
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

  if (!canModifyAnyBranch && branch.restaurant.user.id !== user.id) {
    logger.warn(
      `Update failed - User ${user.id} tried to modify branch ${branch.id} not owned by them`,
    );
    throw new BadRequestException(
      translationService.translate('errors.branch_not_owned', lang),
    );
  }

  if (dto.availableMessages !== undefined) {
    const { availableMessages } = dto;
    branch.availableMessages += availableMessages;

    dto.availableMessages = branch.availableMessages;
  }

  if (dto.phoneNumberAssistant === null) {
    branch.qrUrl = null;
    branch.qrToken = null;
  }

  Object.assign(branch, dto);

  // Si después del assign, phoneNumberAssistant es null, limpiar QR
  if (branch.phoneNumberAssistant === null) {
    branch.qrUrl = null;
    branch.qrToken = null;
  }

  await repository.save(branch);

  logger.log(
    `Branch updated: ${branch.name} by user: ${user.email}. Available messages: ${branch.availableMessages}`,
  );

  return {
    branch,
    message: translationService.translate('branches.branch_updated', lang),
  };
};
