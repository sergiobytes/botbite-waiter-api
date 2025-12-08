import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  RestaurantResponse,
  UpdateRestaurant,
} from '../interfaces/restaurants.interfaces';
import { findOneRestaurantUseCase } from './find-one-restaurant.use-case';
import { UserRoles } from '../../users/enums/user-roles';

export const updateRestaurantUseCase = async (
  params: UpdateRestaurant,
): Promise<RestaurantResponse> => {
  const {
    restaurantId,
    lang,
    user,
    dto,
    logger,
    repository,
    translationService,
  } = params;

  const { restaurant } = await findOneRestaurantUseCase({
    term: restaurantId,
    userId: user.id,
    lang,
    repository,
    translationService,
  });

  if (!restaurant) {
    logger.warn(`Update failed - Restaurant not found: ${restaurantId}`);
    throw new NotFoundException(
      translationService.translate('errors.restaurant_not_found', lang),
    );
  }

  const canModifyAnyRestaurant =
    user.roles.includes(UserRoles.ADMIN) ||
    user.roles.includes(UserRoles.SUPER);

  if (!canModifyAnyRestaurant && restaurant.user.id !== user.id) {
    logger.warn(
      `Update failed - User ${user.id} tried to modify restaurant ${restaurantId} not owned by them`,
    );
    throw new BadRequestException(
      translationService.translate('errors.restaurant_not_owned', lang),
    );
  }

  Object.assign(restaurant, dto);
  await repository.save(restaurant);

  logger.log(`Restaurant updated: ${restaurantId} by user: ${user.email}`);

  return {
    restaurant,
    message: translationService.translate(
      'restaurants.restaurant_updated',
      lang,
    ),
  };
};
