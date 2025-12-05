import { NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { FindOptionsWhere } from 'typeorm';
import { Branch } from '../entities/branch.entity';
import {
  BranchResponse,
  FindBranches,
} from '../interfaces/branches.interfaces';

export const findOneBranchUseCase = async (
  params: FindBranches,
): Promise<BranchResponse> => {
  const { term, logger, restaurantId, repository, translationService, lang } =
    params;

  const whereCondition: FindOptionsWhere<Branch>[] = [];

  if (isUUID(term)) {
    whereCondition.push({ id: term });
  }

  if (restaurantId) {
    whereCondition.push({ restaurant: { id: restaurantId } });
  }
  
  if (!isUUID(term)) {
    whereCondition.push({ name: term, phoneNumberAssistant: term });
  }

  const branch = await repository.findOne({
    where: whereCondition,
    relations: {
      restaurant: { user: true },
      menus: {
        menuItems: { category: true, product: true },
      },
    },
    select: {
      id: true,
      name: true,
      address: true,
      isActive: true,
      phoneNumberAssistant: true,
      phoneNumberReception: true,
      qrUrl: true,
      availableMessages: true,
      restaurant: {
        name: true,
        user: { id: true },
      },
      menus: true,
    },
  });

  if (!branch) {
    logger.warn(`Search failed - Branch not found: ${term}`);
    throw new NotFoundException(
      translationService.translate('errors.branch_not_found', lang),
    );
  }

  return {
    branch,
    message: translationService.translate('branches.branch_found', lang),
  };
};
