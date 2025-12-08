import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { isUUID } from 'class-validator';
import { Restaurant } from './entities/restaurant.entity';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { TranslationService } from '../common/services/translation.service';
import { UserRoles } from '../users/enums/user-roles';
import { FindRestaurantsDto } from './dto/find-resturants.dto';
import { User } from '../users/entities/user.entity';
import { createRestaurantUseCase } from './use-cases/create-restaurant.use-case';
import { updateRestaurantUseCase } from './use-cases/update-restaurant.use-case';
import { changeRestaurantStatusUseCase } from './use-cases/change-restaurant-status.use-case';

@Injectable()
export class RestaurantsService {
  private readonly logger = new Logger(RestaurantsService.name);

  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
    private readonly translationService: TranslationService,
  ) {}

  async createRestaurant(
    createRestaurantDto: CreateRestaurantDto,
    userId: string,
    lang: string,
  ) {
    return createRestaurantUseCase({
      dto: createRestaurantDto,
      userId,
      lang,
      logger: this.logger,
      repository: this.restaurantRepository,
      translationService: this.translationService,
    });
  }

  async updateRestaurant(
    restaurantId: string,
    updateRestaurantDto: UpdateRestaurantDto,
    user: User,
    lang: string,
  ) {
    return updateRestaurantUseCase({
      restaurantId,
      lang,
      user,
      dto: updateRestaurantDto,
      logger: this.logger,
      repository: this.restaurantRepository,
      translationService: this.translationService,
    });
  }

  async activateRestaurant(restaurantId: string, user: User, lang: string) {
    return changeRestaurantStatusUseCase({
      restaurantId,
      lang,
      status: true,
      user,
      repository: this.restaurantRepository,
      translationService: this.translationService,
      logger: this.logger,
    });
  }

  async deactivateRestaurant(restaurantId: string, user: User, lang: string) {
    return changeRestaurantStatusUseCase({
      restaurantId,
      lang,
      status: false,
      user,
      repository: this.restaurantRepository,
      translationService: this.translationService,
      logger: this.logger,
    });
  }

  async findAllRestaurantsByClient(
    user: User,
    paginationDto: PaginationDto,
    searchRestaurantsDto: FindRestaurantsDto = {},
  ) {
    const { limit = 10, offset = 0 } = paginationDto;
    const { name, search, isActive, userEmail } = searchRestaurantsDto;

    const whereConditions: any = {};

    const canViewAllRestaurants =
      user.roles.includes(UserRoles.ADMIN) ||
      user.roles.includes(UserRoles.SUPER);

    if (!canViewAllRestaurants) {
      whereConditions.userId = user.id;
    }

    if (name) {
      whereConditions.name = name;
    } else if (search) {
      whereConditions.name = ILike(`%${search}%`);
    }

    if (isActive !== undefined) {
      whereConditions.isActive = isActive;
    }

    if (userEmail) {
      whereConditions.user = {
        email: ILike(`%${userEmail}%`),
      };
    }

    const [restaurants, total] = await this.restaurantRepository.findAndCount({
      where: whereConditions,
      relations: ['user'],
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

    const sanitizedRestaurants = restaurants.map((restaurant) =>
      this.sanitizeRestaurantResponse(restaurant),
    );

    return {
      restaurants: sanitizedRestaurants,
      total,
      pagination: {
        limit,
        offset,
        totalPages: Math.ceil(total / limit),
        currentPage: Math.floor(offset / limit) + 1,
      },
    };
  }

  async findRestaurantByTerm(term: string, userId?: string) {
    const whereCondition: any = isUUID(term)
      ? [{ id: term }, { name: term }]
      : { name: term };

    if (userId && Array.isArray(whereCondition)) {
      whereCondition.forEach((condition) => (condition.userId = userId));
    }

    return await this.restaurantRepository.findOne({
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
  }

  sanitizeRestaurantResponse(restaurant: Restaurant) {
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
  }
}
