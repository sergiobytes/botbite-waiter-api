import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Restaurant } from './entities/restaurant.entity';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { TranslationService } from '../common/services/translation.service';
import { FindRestaurantsDto } from './dto/find-resturants.dto';
import { User } from '../users/entities/user.entity';
import { createRestaurantUseCase } from './use-cases/create-restaurant.use-case';
import { updateRestaurantUseCase } from './use-cases/update-restaurant.use-case';
import { changeRestaurantStatusUseCase } from './use-cases/change-restaurant-status.use-case';
import { findAllRestaurantsByClientUseCase } from './use-cases/find-all-restaurants-by-client.use-case';
import { findOneRestaurantUseCase } from './use-cases/find-one-restaurant.use-case';

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
    return findAllRestaurantsByClientUseCase({
      user,
      paginationDto,
      findRestaurantsDto: searchRestaurantsDto,
      repository: this.restaurantRepository,
    });
  }

  async findRestaurantByTerm(term: string, userId?: string) {
    return findOneRestaurantUseCase({
      lang: 'es',
      repository: this.restaurantRepository,
      term,
      userId,
      translationService: this.translationService,
    });
  }
}
