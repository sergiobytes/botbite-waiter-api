import { Restaurant } from '../entities/restaurant.entity';

export const sanitizeRestaurantResponse = (restaurant: Restaurant) => {
  return {
    id: restaurant.id,
    name: restaurant.name,
    logoUrl: restaurant.logoUrl,
    isActive: restaurant.isActive,
    createdAt: restaurant.createdAt,
    updatedAt: restaurant.updatedAt,
    owner: restaurant.user
      ? {
          id: restaurant.user.id,
          email: restaurant.user.email,
          isActive: restaurant.user.isActive,
        }
      : null,
  };
};
