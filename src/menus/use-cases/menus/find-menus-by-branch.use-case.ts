import { FindOptionsWhere, ILike } from 'typeorm';
import { findOneBranchUseCase } from '../../../branches/use-cases/find-one-branch.use-case';
import { Menu } from '../../entities/menu.entity';
import { FindMenus, MenuListResponse } from '../../interfaces/menus.interfaces';

export const findMenusByBranchUseCase = async (
  params: FindMenus,
): Promise<MenuListResponse> => {
  const {
    branchId,
    lang,
    logger,
    menuRepository,
    branchRepository,
    translationService,
    paginationDto: paginattionDto,
    findMenuDto,
  } = params;

  await findOneBranchUseCase({
    term: branchId,
    lang,
    repository: branchRepository,
    translationService,
    logger,
  });

  const { limit = 10, offset = 0 } = paginattionDto;
  const { search, isActive } = findMenuDto;

  const whereConditions: FindOptionsWhere<Menu> = { branchId };

  if (search) whereConditions.name = ILike(`%${search}%`);
  if (isActive !== undefined) whereConditions.isActive = isActive;

  const [menus, total] = await menuRepository.findAndCount({
    where: whereConditions,
    relations: { menuItems: true },
    order: { createdAt: 'DESC' },
    skip: offset,
    take: limit,
  });

  return {
    menus,
    total,
    pagination: {
      limit,
      offset,
      totalPages: Math.ceil(total / limit),
      currentPage: Math.floor(offset / limit) + 1,
    },
  };
};
