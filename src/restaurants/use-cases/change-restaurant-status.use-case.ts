import { BadRequestException } from '@nestjs/common';
import {
  ChangeRestaurantStatus,
  RestaurantResponse,
} from '../interfaces/restaurants.interfaces';
import { findOneRestaurantUseCase } from './find-one-restaurant.use-case';
import { UserRoles } from '../../users/enums/user-roles';

export const changeRestaurantStatusUseCase = async (
  params: ChangeRestaurantStatus,
): Promise<RestaurantResponse> => {
  const {
    restaurantId,
    lang,
    status,
    repository,
    translationService,
    logger,
    user,
  } = params;

  const { restaurant } = await findOneRestaurantUseCase({
    lang,
    repository,
    term: restaurantId,
    translationService,
  });

  const canModifyAnyRestaurant =
    user.roles?.includes(UserRoles.ADMIN) ||
    user.roles?.includes(UserRoles.SUPER) ||
    false;

  if (!canModifyAnyRestaurant && restaurant.userId !== user.id) {
    logger.warn(
      status
        ? `Activate failed - User ${user.id} tried to activate restaurant ${restaurantId} not owned by them`
        : `Deactivate failed - User ${user.id} tried to deactivate restaurant ${restaurantId} not owned by them`,
    );
    throw new BadRequestException(
      translationService.translate('errors.restaurant_not_owned', lang),
    );
  }

  if (restaurant.isActive === true && status === true) {
    logger.warn(
      `Activate restaurant failed - Restaurant already active: ${restaurant.name}`,
    );
    throw new BadRequestException(
      translationService.translate(
        'restaurants.restaurant_already_active',
        lang,
      ),
    );
  } else if (restaurant.isActive === false && status === false) {
    logger.warn(
      `Deactivate restaurant failed - Restaurant already inactive: ${restaurant.name}`,
    );
    throw new BadRequestException(
      translationService.translate(
        'restaurants.restaurant_already_inactive',
        lang,
      ),
    );
  }

  restaurant.isActive = status;
  await repository.save(restaurant);

  logger.log(
    `Restaurant ${status ? 'activated' : 'deactivated'}: ${restaurant.name}`,
  );

  return {
    restaurant: restaurant,
    message: translationService.translate(
      status
        ? 'restaurants.restaurant_activated'
        : 'restaurants.restaurant_deactivated',
      lang,
    ),
  };
};
