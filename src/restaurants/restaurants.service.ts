import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Restaurant } from './entities/restaurant.entity';
import { ILike, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { isUUID } from 'class-validator';
import { TranslationService } from '../common/services/translation.service';
import { User } from '../users/entities/user.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { FindRestaurantDto } from './dto/find-resturant.dto';
import { UserRoles } from '../users/enums/user-roles';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantRepo: Repository<Restaurant>,
    private readonly translationService: TranslationService,
  ) {}

  async createRestaurant(
    createRestaurantDto: CreateRestaurantDto,
    userId: string,
  ) {
    const restaurant = this.restaurantRepo.create({
      ...createRestaurantDto,
      user: { id: userId },
    });

    return await this.restaurantRepo.save(restaurant);
  }

  async updateRestaurant(
    restaurantId: string,
    updateRestaurantDto: UpdateRestaurantDto,
    userId: string,
    lang: string,
  ) {
    const restaurant = await this.findRestaurantByTerm(restaurantId);

    if (!restaurant) {
      throw new NotFoundException(
        this.translationService.translate('restaurant.not_found', lang),
      );
    }

    if (restaurant.user.id !== userId) {
      throw new NotFoundException(
        this.translationService.translate('restaurant.not_found', lang),
      );
    }

    Object.assign(restaurant, updateRestaurantDto);

    return await this.restaurantRepo.save(restaurant);
  }

  async activateRestaurant(restaurantId: string, userId: string, lang: string) {
    const restaurant = await this.findRestaurantByTerm(restaurantId);

    if (!restaurant) {
      throw new NotFoundException(
        this.translationService.translate('restaurant.not_found', lang),
      );
    }

    if (restaurant.user.id === userId) {
      throw new NotFoundException(
        this.translationService.translate(
          'errors.cannot_activate_own_restaurant',
          lang,
        ),
      );
    }

    if (!restaurant.user.isActive) {
      throw new BadRequestException(
        this.translationService.translate('errors.user_inactive', lang),
      );
    }

    if (restaurant.isActive) {
      throw new BadRequestException(
        this.translationService.translate('restaurant.already_active', lang),
      );
    }

    restaurant.isActive = true;
    await this.restaurantRepo.save(restaurant);

    return {
      message: this.translationService.translate('restaurant.activated', lang),
    };
  }

  async deactivateRestaurant(
    restaurantId: string,
    userId: string,
    lang: string,
  ) {
    const restaurant = await this.findRestaurantByTerm(restaurantId);

    if (!restaurant) {
      throw new NotFoundException(
        this.translationService.translate('restaurant.not_found', lang),
      );
    }

    if (restaurant.user.id === userId) {
      throw new NotFoundException(
        this.translationService.translate(
          'errors.cannot_activate_own_restaurant',
          lang,
        ),
      );
    }

    if (!restaurant.user.isActive) {
      throw new BadRequestException(
        this.translationService.translate('errors.user_inactive', lang),
      );
    }

    if (!restaurant.isActive) {
      throw new BadRequestException(
        this.translationService.translate('restaurant.already_inactive', lang),
      );
    }

    restaurant.isActive = false;
    await this.restaurantRepo.save(restaurant);

    return {
      message: this.translationService.translate(
        'restaurant.deactivated',
        lang,
      ),
    };
  }

  async findRestaurantByTerm(term: string, userId?: string) {
    const whereCondition: any = isUUID(term)
      ? [{ id: term }, { name: term }]
      : { name: term };

    if (userId && Array.isArray(whereCondition)) {
      whereCondition.forEach((condition) => (condition.userId = userId));
    }

    return await this.restaurantRepo.findOne({
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

  async findRestaurantsByClient(
    user: User,
    paginationDto: PaginationDto,
    findRestaurantDto: FindRestaurantDto = {},
  ) {
    const { limit = 10, offset = 0 } = paginationDto;
    const { name, search, isActive, userEmail } = findRestaurantDto;

    const whereConditions: any = {};
    const isAdminOrSuper =
      user.roles.includes(UserRoles.ADMIN) ||
      user.roles.includes(UserRoles.SUPER);

    if (!isAdminOrSuper) whereConditions.userId = user.id;

    if (name) whereConditions.name = name;
    else if (search) whereConditions.name = ILike(`%${search}%`);

    if (isActive !== undefined) whereConditions.isActive = isActive;
    if (userEmail) whereConditions.user = { email: userEmail };

    const [restaurants, total] = await this.restaurantRepo.findAndCount({
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

  private sanitizeRestaurantResponse(restaurant: Restaurant) {
    return {
      id: restaurant.id,
      name: restaurant.name,
      logoUrl: restaurant.logoUrl,
      isActive: restaurant.isActive,
      createdAt: restaurant.createdAt,
      updatedAt: restaurant.updatedAt,
      owner: {
        id: restaurant.user.id,
        email: restaurant.user.email,
        isActive: restaurant.user.isActive,
      },
    };
  }
}
