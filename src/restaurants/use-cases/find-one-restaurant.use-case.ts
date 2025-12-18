import { FindOptionsWhere } from 'typeorm';
import {
  FindRestaurant,
  RestaurantResponse,
} from '../interfaces/restaurants.interfaces';
import { Restaurant } from '../entities/restaurant.entity';
import { isUUID } from 'class-validator';

export const findOneRestaurantUseCase = async (
  params: FindRestaurant,
): Promise<RestaurantResponse> => {
  const { term, lang, repository, translationService } = params;

  const whereCondition: FindOptionsWhere<Restaurant>[] = isUUID(term)
    ? [{ id: term }, { name: term }]
    : [{ name: term }];

  const restaurant = await repository.findOne({
    where: whereCondition,
    relations: {
      user: true,
    },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      isActive: true,
      user: {
        id: true,
        isActive: true,
      },
    },
  });

  if (!restaurant) {
    throw new Error(
      translationService.translate('errors.restaurant_not_found', lang),
    );
  }

  return {
    restaurant,
    message: translationService.translate('restaurants.restaurant_found', lang),
  };
};
