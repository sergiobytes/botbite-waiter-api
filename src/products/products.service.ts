import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ILike, Repository } from 'typeorm';
import { TranslationService } from '../common/services/translation.service';
import { CreateProductDto } from './dto/create-product.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { FindProductsDto } from './dto/find-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { User } from '../users/entities/user.entity';
import { UserRoles } from '../users/enums/user-roles';
import { createProductUseCase } from './use-cases/create-product.use-case';
import { bulkCreateProductsUseCase } from './use-cases/bulk-create-products.use-case';
import { findOneProductUseCase } from './use-cases/find-one-product.use-case';
import { updateProductUseCase } from './use-cases/update-product.use-case';

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
    const { product } = await this.findByTerm(productId, restaurantId);

    if (!product) {
      this.logger.warn(`Activate failed - Product not found: ${productId}`);
      throw new NotFoundException(
        this.translationService.translate('errors.product_not_found', lang),
      );
    }

    const canModifyAnyProduct =
      user.roles.includes(UserRoles.ADMIN) ||
      user.roles.includes(UserRoles.SUPER);

    if (!canModifyAnyProduct && product.restaurant.user.id !== user.id) {
      this.logger.warn(
        `Activate failed - User ${user.id} tried to activate product ${product.id} not owned by them`,
      );
      throw new BadRequestException(
        this.translationService.translate('errors.product_not_owned', lang),
      );
    }

    if (product.isActive) {
      this.logger.warn(
        `Activate failed - Product already active: ${product.id}`,
      );
      throw new BadRequestException(
        this.translationService.translate(
          'products.product_already_active',
          lang,
        ),
      );
    }

    product.isActive = true;
    await this.productRepository.save(product);

    this.logger.log(`Product activated: ${product.id} by user: ${user.email}`);

    return {
      message: this.translationService.translate(
        'products.product_activated',
        lang,
      ),
    };
  }

  async deactivateProduct(
    productId: string,
    restaurantId: string,
    user: User,
    lang: string,
  ) {
    const { product } = await this.findByTerm(productId, restaurantId);

    if (!product) {
      this.logger.warn(`Activate failed - Product not found: ${productId}`);
      throw new NotFoundException(
        this.translationService.translate('errors.product_not_found', lang),
      );
    }

    const canModifyAnyProduct =
      user.roles.includes(UserRoles.ADMIN) ||
      user.roles.includes(UserRoles.SUPER);

    if (!canModifyAnyProduct && product.restaurant.user.id !== user.id) {
      this.logger.warn(
        `Activate failed - User ${user.id} tried to activate product ${product.id} not owned by them`,
      );
      throw new BadRequestException(
        this.translationService.translate('errors.product_not_owned', lang),
      );
    }

    if (!product.isActive) {
      this.logger.warn(
        `Activate failed - Product already inactive: ${product.id}`,
      );
      throw new BadRequestException(
        this.translationService.translate(
          'products.product_already_inactive',
          lang,
        ),
      );
    }

    product.isActive = false;
    await this.productRepository.save(product);

    this.logger.log(`Product activated: ${product.id} by user: ${user.email}`);

    return {
      message: this.translationService.translate(
        'products.product_deactivated',
        lang,
      ),
    };
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
