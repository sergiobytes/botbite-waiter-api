import {
  BadRequestException,
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { UserRoles } from '../users/enums/user-roles';
import { CreateProductDto } from './dto/create-product.dto';
import { Lang } from '../common/decorators/lang.decorator';
import { FileInterceptor } from '@nestjs/platform-express';

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

  @Post('restaurantId/bulk-upload')
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
}
