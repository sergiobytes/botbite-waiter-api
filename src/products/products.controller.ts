import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { UserRoles } from '../users/enums/user-roles';
import { CreateProductDto } from './dto/create-product.dto';
import { Lang } from '../common/decorators/lang.decorator';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post(':restaurantId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  createProduct(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Body() createProductDto: CreateProductDto,
    @Lang() lang: string,
  ) {
    return this.productsService.create(restaurantId, createProductDto, lang);
  }
}
