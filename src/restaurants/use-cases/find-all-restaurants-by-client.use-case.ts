import { FindOptionsWhere, ILike } from 'typeorm';
import {
  FindRestaurants,
  RestaurantListResponse,
} from '../interfaces/restaurants.interfaces';
import { Restaurant } from '../entities/restaurant.entity';
import { UserRoles } from '../../users/enums/user-roles';

export const findAllRestaurantsByClientUseCase = async (
  params: FindRestaurants,
): Promise<RestaurantListResponse> => {
  const { paginationDto, findRestaurantsDto, user, repository } = params;

  const { limit = 10, offset = 0 } = paginationDto;
  const { name, search, isActive, userEmail } = findRestaurantsDto;

  const whereConditions: FindOptionsWhere<Restaurant> = {};

  const canViewAllRestaurants =
    user.roles.includes(UserRoles.ADMIN) ||
    user.roles.includes(UserRoles.SUPER);

  if (!canViewAllRestaurants) whereConditions.userId = user.id;

  if (name) whereConditions.name = name;
  if (search) whereConditions.name = ILike(`%${search}%`);
  if (isActive !== undefined) whereConditions.isActive = isActive;
  if (userEmail) whereConditions.user = { email: ILike(`%${userEmail}%`) };

  const [restaurants, total] = await repository.findAndCount({
    where: whereConditions,
    relations: { user: true },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      user: {
        id: true,
        email: true,
        isActive: true,
      },
    },
    order: { createdAt: 'DESC' },
    skip: offset,
    take: limit,
  });

  return {
    restaurants,
    total,
    pagination: {
      limit,
      offset,
      totalPages: Math.ceil(total / limit),
      currentPage: Math.floor(offset / limit) + 1,
    },
  };
};
