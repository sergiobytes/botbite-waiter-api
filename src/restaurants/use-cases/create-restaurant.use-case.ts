import { RestaurantResponse } from '../../../dist/restaurants/interfaces/restaurants.interfaces';
import { CreateRestaurant } from '../interfaces/restaurants.interfaces';

export const createRestaurantUseCase = async (
  params: CreateRestaurant,
): Promise<RestaurantResponse> => {
  const { dto, lang, userId, logger, repository, translationService } = params;

  const restaurant = repository.create({
    ...dto,
    userId,
  });

  await repository.save(restaurant);

  logger.log(`Restaurant created: ${restaurant.name} by user: ${userId}`);

  return {
    restaurant,
    message: translationService.translate(
      'restaurants.restaurant_created',
      lang,
    ),
  };
};
