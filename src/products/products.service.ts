import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { TranslationService } from '../common/services/translation.service';
import { CreateProductDto } from './dto/create-product.dto';
import { Readable } from 'stream';

import * as csv from 'csv-parser';
import { ICsvRow } from './interfaces/csv-row.interface';

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
    const product = this.productRepository.create({
      ...createProductDto,
      restaurant: { id: restaurantId },
    });

    await this.productRepository.save(product);
    return {
      message: this.translationService.translate(
        'products.product_created',
        lang,
      ),
    };
  }

  async bulkCreate(
    restaurantId: string,
    file: Express.Multer.File,
    lang: string,
  ) {
    try {
      const stream = Readable.from(file.buffer.toString());
      const products: CreateProductDto[] = await this.parseCsvFile(stream);

      if (products.length === 0) {
        throw new BadRequestException(
          this.translationService.translate('errors.empty_csv_file', lang),
        );
      }

      const productsToSave = products.map((product) =>
        this.productRepository.create({
          ...product,
          restaurant: { id: restaurantId },
        }),
      );

      const savedProducts = await this.productRepository.save(productsToSave);

      this.logger.log(
        `Bulk created ${savedProducts.length} products for restaurant: ${restaurantId}`,
      );

      return {
        products: savedProducts,
        count: savedProducts.length,
        message: this.translationService.translate(
          'products.products_bulk_created',
          lang,
        ),
      };
    } catch (error) {
      this.logger.error(
        `Bulk create failed for restaurant ${restaurantId}: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        this.translationService.translate('errors.csv_processing_failed', lang),
      );
    }
  }

  async activateProduct() {}

  async deactivateProduct() {}

  async findByTerm() {}

  async findAllByRestaurant() {}

  private parseCsvFile(stream: Readable): Promise<CreateProductDto[]> {
    return new Promise((resolve, reject) => {
      const products: CreateProductDto[] = [];

      stream
        .pipe(csv())
        .on('data', (row: ICsvRow) => {
          if (row.nombre && row.nombre.trim()) {
            products.push({
              name: row.nombre.trim(),
              description: row.descripcion?.trim() || '',
            });
          }
        })
        .on('end', () => {
          resolve(products);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }
}
