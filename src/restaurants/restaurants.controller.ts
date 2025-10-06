import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { UserRoles } from '../users/enums/user-roles';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { Lang } from '../common/decorators/lang.decorator';
import { FindRestaurantsDto } from './dto/find-resturants.dto';

@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Post()
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  createRestaurant(
    @Body() createRestaurantDto: CreateRestaurantDto,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    return this.restaurantsService.createRestaurant(
      createRestaurantDto,
      user.id,
      lang,
    );
  }

  @Patch(':restaurantId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  updateRestaurant(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Body() updateRestaurantDto: UpdateRestaurantDto,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    return this.restaurantsService.updateRestaurant(
      restaurantId,
      updateRestaurantDto,
      user,
      lang,
    );
  }

  @Patch('activate/:restaurantId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  activateRestaurant(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    return this.restaurantsService.activateRestaurant(restaurantId, user, lang);
  }

  @Delete(':restaurantId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  deactivateRestaurant(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    return this.restaurantsService.deactivateRestaurant(
      restaurantId,
      user,
      lang,
    );
  }

  @Get('find-user/:term')
  @Auth([UserRoles.USER])
  findRestaurantByTerm(@Param('term') term: string) {
    return this.restaurantsService.findRestaurantByTerm(term);
  }

  @Get()
  @Auth([UserRoles.CLIENT, UserRoles.ADMIN, UserRoles.SUPER])
  findRestaurantsByClient(
    @Query() findRestaurantsDto: FindRestaurantsDto,
    @CurrentUser() user: User,
  ) {
    const { limit, offset, ...searchFilters } = findRestaurantsDto;

    return this.restaurantsService.findAllRestaurantsByClient(
      user,
      { limit, offset },
      searchFilters,
    );
  }
}
