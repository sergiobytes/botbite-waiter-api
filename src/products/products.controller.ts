import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { UserRoles } from '../users/enums/user-roles';
import { CreateProductDto } from './dto/create-product.dto';
import { Lang } from '../common/decorators/lang.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { FindProductsDto } from './dto/find-products.dto';
import { User } from '../users/entities/user.entity';
import { UpdateProductDto } from './dto/update-product.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

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

  @Post('bulk-upload/:restaurantId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  @UseInterceptors(FileInterceptor('file'))
  bulkCreate(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @UploadedFile() file: Express.Multer.File,
    @Lang() lang: string,
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    if (file.mimetype !== 'text/csv' && !file.originalname.endsWith('.csv')) {
      throw new BadRequestException('Only CSV files are allowed');
    }

    return this.productsService.bulkCreate(restaurantId, file, lang);
  }

  @Get('restaurant/:restaurantId/:term')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  findByTerm(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('term') term: string,
  ) {
    return this.productsService.findByTerm(term, restaurantId);
  }

  @Get('restaurant/:restaurantId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  findAllByRestaurant(
    @Query() findProductsDto: FindProductsDto,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
  ) {
    const { limit, offset, ...searchFilters } = findProductsDto;
    return this.productsService.findAllByRestaurant(
      restaurantId,
      {
        limit,
        offset,
      },
      searchFilters,
    );
  }

  @Patch('restaurant/:restaurantId/:productId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  updateProduct(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    return this.productsService.update(
      productId,
      restaurantId,
      updateProductDto,
      user,
      lang,
    );
  }

  @Patch('activate/:restaurantId/:productId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  activateProduct(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    return this.productsService.activateProduct(
      productId,
      restaurantId,
      user,
      lang,
    );
  }

  @Delete(':restaurantId/:productId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  deactivateProduct(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    return this.productsService.deactivateProduct(
      productId,
      restaurantId,
      user,
      lang,
    );
  }
}
