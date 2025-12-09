import { FindOptionsWhere, ILike } from 'typeorm';
import { Branch } from '../entities/branch.entity';
import {
  BranchesByRestaurant,
  BranchListResponse,
} from '../interfaces/branches.interfaces';

export const findAllBranchesByRestaurantUseCase = async (
  params: BranchesByRestaurant,
): Promise<BranchListResponse> => {
  const { restaurantId, paginationDto, findBranchDto, repository } = params;

  const { limit = 10, offset = 0 } = paginationDto;
  const { name, search, isActive } = findBranchDto;

  const whereCoindition: FindOptionsWhere<Branch> = {
    restaurant: { id: restaurantId },
  };

  if (name) whereCoindition.name = name;
  if (search) whereCoindition.name = ILike(`%${search}%`);

  if (isActive !== undefined) whereCoindition.isActive = isActive;

  const [branches, total] = await repository.findAndCount({
    where: whereCoindition,
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
      surveyUrl: true,
      qrUrl: true,
      availableMessages: true,
      createdAt: true,
      restaurant: {
        name: true,
        user: { id: true },
      },
      menus: true,
    },
    order: { createdAt: 'DESC' },
    skip: offset,
    take: limit,
  });

  return {
    branches,
    total,
    pagination: {
      limit,
      offset,
      totalPages: Math.ceil(total / limit),
      currentPage: Math.ceil(offset / limit) + 1,
    },
  };
};
