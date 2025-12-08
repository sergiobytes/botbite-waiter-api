import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ILike, Repository } from 'typeorm';
import { TranslationService } from '../common/services/translation.service';
import { CreateProductDto } from './dto/create-product.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { FindProductsDto } from './dto/find-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { User } from '../users/entities/user.entity';
import { createProductUseCase } from './use-cases/create-product.use-case';
import { bulkCreateProductsUseCase } from './use-cases/bulk-create-products.use-case';
import { findOneProductUseCase } from './use-cases/find-one-product.use-case';
import { updateProductUseCase } from './use-cases/update-product.use-case';
import { changeProductStatusUseCase } from './use-cases/change-product-status.use-case';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly translationService: TranslationService,
  ) {}

  async create(
    restaurantId: string,
    createProductDto: CreateProductDto,
    lang: string,
  ) {
    return createProductUseCase({
      restaurantId,
      dto: createProductDto,
      lang,
      repository: this.productRepository,
      translationService: this.translationService,
    });
  }

  async bulkCreate(
    restaurantId: string,
    file: Express.Multer.File,
    lang: string,
  ) {
    return bulkCreateProductsUseCase({
      file,
      repository: this.productRepository,
      logger: this.logger,
      translationService: this.translationService,
      restaurantId,
      lang,
    });
  }

  async update(
    productId: string,
    restaurantId: string,
    updateProductDto: UpdateProductDto,
    user: User,
    lang: string,
  ) {
    return updateProductUseCase({
      productId,
      restaurantId,
      dto: updateProductDto,
      user,
      lang,
      logger: this.logger,
      repository: this.productRepository,
      translationService: this.translationService,
    });
  }

  async activateProduct(
    productId: string,
    restaurantId: string,
    user: User,
    lang: string,
  ) {
    return changeProductStatusUseCase({
      productId,
      restaurantId,
      lang,
      status: true,
      user,
      repository: this.productRepository,
      logger: this.logger,
      translationService: this.translationService,
    });
  }

  async deactivateProduct(
    productId: string,
    restaurantId: string,
    user: User,
    lang: string,
  ) {
    return changeProductStatusUseCase({
      productId,
      restaurantId,
      lang,
      status: false,
      user,
      repository: this.productRepository,
      logger: this.logger,
      translationService: this.translationService,
    });
  }

  async findByTerm(term: string, restaurantId: string) {
    return findOneProductUseCase({
      term,
      restaurantId,
      lang: 'es',
      repository: this.productRepository,
      logger: this.logger,
      translationService: this.translationService,
    });
  }

  async findAllByRestaurant(
    restaurantId: string,
    paginationDto: PaginationDto,
    findProductsDto: FindProductsDto = {},
  ) {
    const { limit = 10, offset = 0 } = paginationDto;
    const { name, search, isActive } = findProductsDto;

    const whereConditions: any = { restaurant: { id: restaurantId } };

    if (name) {
      whereConditions.name = name;
    } else if (search) {
      whereConditions.name = ILike(`%${search}%`);
    }

    if (isActive !== undefined) {
      whereConditions.isActive = isActive;
    }

    const [products, total] = await this.productRepository.findAndCount({
      where: whereConditions,
      relations: {
        restaurant: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        restaurant: {
          name: true,
        },
      },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    return {
      products,
      total,
      pagination: {
        limit,
        offset,
        totalPages: Math.ceil(total / limit),
        currentPage: Math.floor(offset / limit) + 1,
      },
    };
  }
}
